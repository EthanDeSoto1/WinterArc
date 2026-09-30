CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (username = lower(username)),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  times_per_week INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (frequency = 'daily' AND times_per_week IS NULL)
    OR (frequency = 'weekly' AND times_per_week IS NOT NULL AND times_per_week BETWEEN 1 AND 7)
  )
);

CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_on TEXT NOT NULL CHECK (completed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (goal_id, completed_on)
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (requester_id <> addressee_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair
  ON friendships (min(requester_id, addressee_id), max(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS friendships_requester_status ON friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS friendships_addressee_status ON friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS goals_user_active ON goals (user_id, is_active);
CREATE INDEX IF NOT EXISTS completions_user_completed_at ON completions (user_id, completed_at);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires);
