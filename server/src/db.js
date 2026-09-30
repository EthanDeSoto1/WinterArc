import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const databasePath = process.env.DATABASE_PATH || path.resolve(import.meta.dirname, '../data/winter-arc.db')
fs.mkdirSync(path.dirname(databasePath), { recursive: true })

const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')
db.pragma('synchronous = NORMAL')

const schema = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8')
db.exec(schema)

const migrations = [
  `
  ALTER TABLE goals ADD COLUMN archived_at TEXT;
  UPDATE goals SET archived_at = created_at WHERE is_active = 0;
  `,
  `
  ALTER TABLE goals ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
  UPDATE goals SET position = id;
  `,
  `
  ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT 'frost';
  `,
  `
  CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX posts_user ON posts (user_id);
  CREATE TABLE post_reactions (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('fire', 'muscle', 'clap')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (post_id, user_id, kind)
  );
  CREATE INDEX post_reactions_user ON post_reactions (user_id);
  `,
  `
  ALTER TABLE posts ADD COLUMN photo TEXT;
  ALTER TABLE posts ADD COLUMN photo_width INTEGER;
  ALTER TABLE posts ADD COLUMN photo_height INTEGER;
  CREATE TABLE post_reactions_one (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('fire', 'muscle', 'clap')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (post_id, user_id)
  );
  INSERT INTO post_reactions_one (post_id, user_id, kind, created_at)
    SELECT post_id, user_id, kind, created_at FROM post_reactions AS reaction
    WHERE rowid = (
      SELECT rowid FROM post_reactions
      WHERE post_id = reaction.post_id AND user_id = reaction.user_id
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    );
  DROP TABLE post_reactions;
  ALTER TABLE post_reactions_one RENAME TO post_reactions;
  CREATE INDEX post_reactions_user ON post_reactions (user_id);
  `,
  `
  CREATE TABLE post_comments (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX post_comments_post ON post_comments (post_id, id);
  CREATE INDEX post_comments_user ON post_comments (user_id);
  `,
  `
  CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX push_subscriptions_user ON push_subscriptions (user_id);
  CREATE TABLE sent_notifications (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    day TEXT NOT NULL,
    PRIMARY KEY (user_id, kind, day)
  );
  ALTER TABLE users ADD COLUMN notify_posts INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN notify_my_posts INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN notify_friend_done INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN notify_friend_goals INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN remind_morning INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN remind_midday INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN remind_evening INTEGER NOT NULL DEFAULT 1;
  `,
]

const currentVersion = db.pragma('user_version', { simple: true })
for (let version = currentVersion; version < migrations.length; version++) {
  db.transaction(() => {
    db.exec(migrations[version])
    db.pragma(`user_version = ${version + 1}`)
  })()
}

export default db
