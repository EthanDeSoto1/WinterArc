import express from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import db from './db.js'
import { requireAuth, isAdmin, currentInviteCode } from './auth.js'
import { readId } from './validation.js'

const PASSWORD_ROUNDS = 12

const findUsers = db.prepare(`
  SELECT users.id, users.username, users.display_name, users.avatar_color, users.created_at,
    (SELECT count(*) FROM goals WHERE goals.user_id = users.id AND goals.is_active = 1) AS active_goals,
    (SELECT max(completed_at) FROM completions WHERE completions.user_id = users.id) AS last_checkoff
  FROM users
  ORDER BY users.display_name COLLATE NOCASE, users.username
`)
const findUser = db.prepare('SELECT * FROM users WHERE id = ?')
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
const deleteSessions = db.prepare('DELETE FROM sessions WHERE json_extract(data, ?) = ?')
const deletePushDevices = db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
const saveSetting = db.prepare(`
  INSERT INTO app_settings (key, value) VALUES (?, ?)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value
`)

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Only the admin can do that' })
  }
  next()
}

function readInviteCode(value) {
  if (typeof value !== 'string') {
    return { error: 'The invite code must be text' }
  }
  const code = value.trim()
  if (code.length < 4 || code.length > 64 || /\s/.test(code)) {
    return { error: 'The invite code must be 4 to 64 characters with no spaces' }
  }
  return { value: code }
}

const router = express.Router()

router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  res.json({
    users: findUsers.all().map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
      createdAt: row.created_at,
      activeGoals: row.active_goals,
      lastCheckoff: row.last_checkoff,
      isYou: row.id === req.user.id,
    })),
  })
})

router.post('/admin/users/:id/password', requireAuth, requireAdmin, async (req, res) => {
  const id = readId(req.params.id, 'user')
  if (id.error) {
    return res.status(400).json({ error: id.error })
  }
  const user = findUser.get(id.value)
  if (!user) {
    return res.status(404).json({ error: 'That user no longer exists' })
  }
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Change your own password under Password instead' })
  }
  const password = crypto.randomBytes(9).toString('base64url')
  const hash = await bcrypt.hash(password, PASSWORD_ROUNDS)
  db.transaction(() => {
    updatePassword.run(hash, user.id)
    deleteSessions.run('$.userId', user.id)
    deletePushDevices.run(user.id)
  })()
  res.json({ username: user.username, password })
})

router.get('/admin/invite', requireAuth, requireAdmin, (req, res) => {
  res.json({ inviteCode: currentInviteCode() })
})

router.put('/admin/invite', requireAuth, requireAdmin, (req, res) => {
  const code = readInviteCode(req.body.inviteCode)
  if (code.error) {
    return res.status(400).json({ error: code.error })
  }
  saveSetting.run('invite_code', code.value)
  res.json({ inviteCode: code.value })
})

export default router
