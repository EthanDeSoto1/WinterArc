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
  `
  ALTER TABLE users ADD COLUMN board_seen_post_id INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN notify_friend_requests INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN remind_morning_hour INTEGER NOT NULL DEFAULT 8;
  ALTER TABLE users ADD COLUMN remind_midday_hour INTEGER NOT NULL DEFAULT 12;
  ALTER TABLE users ADD COLUMN remind_evening_hour INTEGER NOT NULL DEFAULT 20;
  `,
  `
  ALTER TABLE users ADD COLUMN intro_seen INTEGER NOT NULL DEFAULT 0;
  `,
  `
  ALTER TABLE goals ADD COLUMN target REAL;
  ALTER TABLE goals ADD COLUMN unit TEXT;
  CREATE TABLE goal_amounts (
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    logged_on TEXT NOT NULL,
    amount REAL NOT NULL,
    PRIMARY KEY (goal_id, logged_on)
  );
  CREATE TABLE cheers (
    completion_id INTEGER NOT NULL REFERENCES completions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (completion_id, user_id)
  );
  CREATE INDEX cheers_user ON cheers (user_id);
  CREATE TABLE milestones (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    streak INTEGER NOT NULL,
    reached_on TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (goal_id, streak, reached_on)
  );
  CREATE INDEX milestones_user ON milestones (user_id);
  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  ALTER TABLE posts ADD COLUMN edited_at TEXT;
  ALTER TABLE users ADD COLUMN notify_cheers INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN notify_threads INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN notify_weekly_recap INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN wrapped_seen INTEGER NOT NULL DEFAULT 0;
  `,
  `
  ALTER TABLE users ADD COLUMN board_seen_comment_id INTEGER NOT NULL DEFAULT 0;
  UPDATE users SET board_seen_comment_id = (SELECT coalesce(max(id), 0) FROM post_comments);
  `,
  `
  CREATE TABLE comment_reactions (
    comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('fire', 'muscle', 'clap')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (comment_id, user_id)
  );
  CREATE INDEX comment_reactions_user ON comment_reactions (user_id);
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
