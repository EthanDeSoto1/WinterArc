import express from 'express'
import bcrypt from 'bcrypt'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import db from './db.js'
import { todayInTimezone, seasonRange } from './dates.js'
import {
  readUsername,
  readDisplayName,
  readEmail,
  readNewPassword,
  readTimezone,
  readAvatarColor,
  firstError,
} from './validation.js'

export const SESSION_COOKIE_NAME = 'winterarc.sid'
const PASSWORD_ROUNDS = 12
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', PASSWORD_ROUNDS)

const findUserById = db.prepare('SELECT * FROM users WHERE id = ?')
const markIntroSeen = db.prepare('UPDATE users SET intro_seen = 1 WHERE id = ?')
const findUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?')
const findUserByEmail = db.prepare('SELECT id FROM users WHERE email = ?')
const insertUser = db.prepare(`
  INSERT INTO users (username, display_name, email, password_hash, timezone)
  VALUES (?, ?, ?, ?, ?)
`)
const updateUser = db.prepare('UPDATE users SET display_name = ?, timezone = ?, avatar_color = ? WHERE id = ?')
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
const deleteOtherSessions = db.prepare("DELETE FROM sessions WHERE json_extract(data, '$.userId') = ? AND sid != ?")
const deletePushDevices = db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?')

const loginLimiterPerAccount = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body.username || '').trim().toLowerCase()}`,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
})

const loginLimiterPerDevice = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
})

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { error: 'Too many password attempts. Try again in 15 minutes.' },
})

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign up attempts. Try again in an hour.' },
})

function shouldShowIntro(user) {
  const today = todayInTimezone(user.timezone)
  return user.intro_seen === 0 && today >= seasonRange(today).start
}

export function userToJson(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    timezone: user.timezone,
    avatarColor: user.avatar_color,
    createdAt: user.created_at,
    showIntro: shouldShowIntro(user),
  }
}

function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return reject(regenerateError)
      }
      req.session.userId = userId
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()))
    })
  })
}

export function requireAuth(req, res, next) {
  const userId = req.session.userId
  if (!userId) {
    return res.status(401).json({ error: 'Please log in' })
  }
  const user = findUserById.get(userId)
  if (!user) {
    return req.session.destroy(() => res.status(401).json({ error: 'Please log in' }))
  }
  req.user = user
  next()
}

const router = express.Router()

router.post('/signup', signupLimiter, async (req, res) => {
  const username = readUsername(req.body.username)
  const displayName = readDisplayName(req.body.displayName)
  const email = readEmail(req.body.email)
  const password = readNewPassword(req.body.password)
  const timezone = readTimezone(req.body.timezone)
  const error = firstError([username, displayName, email, password, timezone])
  if (error) {
    return res.status(400).json({ error })
  }

  const requiredInviteCode = process.env.INVITE_CODE || ''
  const givenInviteCode = typeof req.body.inviteCode === 'string' ? req.body.inviteCode.trim() : ''
  if (requiredInviteCode && givenInviteCode !== requiredInviteCode) {
    return res.status(403).json({ error: 'That invite code is not valid' })
  }

  if (findUserByUsername.get(username.value)) {
    return res.status(409).json({ error: 'That username is already taken' })
  }
  if (findUserByEmail.get(email.value)) {
    return res.status(409).json({ error: 'An account with that email already exists' })
  }

  const passwordHash = await bcrypt.hash(password.value, PASSWORD_ROUNDS)
  let result
  try {
    result = insertUser.run(username.value, displayName.value, email.value, passwordHash, timezone.value)
  } catch (insertError) {
    if (insertError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That username or email is already taken' })
    }
    throw insertError
  }

  await startSession(req, result.lastInsertRowid)
  res.status(201).json({ user: userToJson(findUserById.get(result.lastInsertRowid)) })
})

router.post('/login', loginLimiterPerDevice, loginLimiterPerAccount, async (req, res) => {
  const { username, password } = req.body
  if (typeof username !== 'string' || username.trim() === '' || typeof password !== 'string' || password === '') {
    return res.status(400).json({ error: 'Enter your username and password' })
  }
  if (username.length > 100 || password.length > 200) {
    return res.status(401).json({ error: 'Wrong username or password' })
  }

  const user = findUserByUsername.get(username.trim().toLowerCase())
  const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Wrong username or password' })
  }

  await startSession(req, user.id)
  res.json({ user: userToJson(user) })
})

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error)
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
    res.status(204).end()
  })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: userToJson(req.user) })
})

router.patch('/me', requireAuth, (req, res) => {
  const hasDisplayName = req.body.displayName !== undefined
  const hasTimezone = req.body.timezone !== undefined
  const hasAvatarColor = req.body.avatarColor !== undefined
  if (!hasDisplayName && !hasTimezone && !hasAvatarColor) {
    return res.status(400).json({ error: 'Nothing to update' })
  }
  const displayName = hasDisplayName ? readDisplayName(req.body.displayName) : { value: req.user.display_name }
  const timezone = hasTimezone ? readTimezone(req.body.timezone) : { value: req.user.timezone }
  const avatarColor = hasAvatarColor ? readAvatarColor(req.body.avatarColor) : { value: req.user.avatar_color }
  const error = firstError([displayName, timezone, avatarColor])
  if (error) {
    return res.status(400).json({ error })
  }

  updateUser.run(displayName.value, timezone.value, avatarColor.value, req.user.id)
  res.json({ user: userToJson(findUserById.get(req.user.id)) })
})

router.post('/me/intro', requireAuth, (req, res) => {
  markIntroSeen.run(req.user.id)
  res.json({ user: userToJson(findUserById.get(req.user.id)) })
})

router.post('/me/password', requireAuth, passwordChangeLimiter, async (req, res) => {
  const { currentPassword } = req.body
  if (typeof currentPassword !== 'string' || currentPassword === '') {
    return res.status(400).json({ error: 'Enter your current password' })
  }
  const newPassword = readNewPassword(req.body.newPassword)
  if (newPassword.error) {
    return res.status(400).json({ error: `New ${newPassword.error.toLowerCase()}` })
  }

  const currentMatches = currentPassword.length <= 200 && (await bcrypt.compare(currentPassword, req.user.password_hash))
  if (!currentMatches) {
    return res.status(403).json({ error: 'Your current password is wrong' })
  }
  if (newPassword.value === currentPassword) {
    return res.status(400).json({ error: 'Pick a new password that is different from your current one' })
  }

  const passwordHash = await bcrypt.hash(newPassword.value, PASSWORD_ROUNDS)
  updatePassword.run(passwordHash, req.user.id)
  await startSession(req, req.user.id)
  const signedOut = deleteOtherSessions.run(req.user.id, req.sessionID).changes
  deletePushDevices.run(req.user.id)
  res.json({ signedOut })
})

export default router
