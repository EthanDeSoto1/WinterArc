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

export default db
