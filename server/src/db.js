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
]

const currentVersion = db.pragma('user_version', { simple: true })
for (let version = currentVersion; version < migrations.length; version++) {
  db.transaction(() => {
    db.exec(migrations[version])
    db.pragma(`user_version = ${version + 1}`)
  })()
}

export default db
