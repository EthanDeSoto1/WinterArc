import session from 'express-session'
import db from './db.js'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

const findSession = db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires > ?')
const saveSession = db.prepare(`
  INSERT INTO sessions (sid, data, expires) VALUES (?, ?, ?)
  ON CONFLICT (sid) DO UPDATE SET data = excluded.data, expires = excluded.expires
`)
const deleteSession = db.prepare('DELETE FROM sessions WHERE sid = ?')
const touchSession = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?')
const deleteExpiredSessions = db.prepare('DELETE FROM sessions WHERE expires <= ?')

function expiryTime(sessionData) {
  if (sessionData.cookie && sessionData.cookie.expires) {
    return new Date(sessionData.cookie.expires).getTime()
  }
  return Date.now() + THIRTY_DAYS
}

export default class SqliteSessionStore extends session.Store {
  constructor() {
    super()
    setInterval(() => deleteExpiredSessions.run(Date.now()), 60 * 60 * 1000).unref()
  }

  get(sid, callback) {
    try {
      const row = findSession.get(sid, Date.now())
      callback(null, row ? JSON.parse(row.data) : null)
    } catch (error) {
      callback(error)
    }
  }

  set(sid, sessionData, callback) {
    try {
      saveSession.run(sid, JSON.stringify(sessionData), expiryTime(sessionData))
      callback(null)
    } catch (error) {
      callback(error)
    }
  }

  destroy(sid, callback) {
    try {
      deleteSession.run(sid)
      callback(null)
    } catch (error) {
      callback(error)
    }
  }

  touch(sid, sessionData, callback) {
    try {
      touchSession.run(expiryTime(sessionData), sid)
      callback(null)
    } catch (error) {
      callback(error)
    }
  }
}
