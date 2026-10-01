import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { readId, readSearchQuery, readUsername } from './validation.js'
import { goalsWithStatus, isFinishedToday } from './goals.js'
import { notifyFriendship } from './events.js'
import { notifyFriendRequest, notifyRequestAccepted, notifyNudge, markSentOnce } from './push.js'
import { seasonRange, longestDailyRun } from './dates.js'

const SEARCH_LIMIT = 20

const findUserById = db.prepare('SELECT id, username, display_name, avatar_color FROM users WHERE id = ?')
const findFullUser = db.prepare('SELECT * FROM users WHERE id = ?')
const findSentNudge = db.prepare('SELECT 1 FROM sent_notifications WHERE user_id = ? AND kind = ? AND day = ?')
const findMilestones = db.prepare(`
  SELECT milestones.id, milestones.streak, milestones.reached_on, goals.id AS goal_id, goals.title, goals.frequency
  FROM milestones JOIN goals ON goals.id = milestones.goal_id
  WHERE milestones.user_id = ?
  ORDER BY milestones.reached_on DESC, milestones.streak DESC
`)
const findSeasonCompletions = db.prepare(`
  SELECT completions.goal_id, completions.completed_on, goals.frequency
  FROM completions JOIN goals ON goals.id = completions.goal_id
  WHERE completions.user_id = ? AND completions.completed_on BETWEEN ? AND ?
`)
const findUserWithTimezone = db.prepare('SELECT id, username, display_name, avatar_color, timezone FROM users WHERE id = ?')
const findUserByUsername = db.prepare('SELECT id, username, display_name, avatar_color FROM users WHERE username = ?')
const searchUsers = db.prepare(`
  SELECT id, username, display_name, avatar_color FROM users
  WHERE username GLOB ? AND id <> ?
  ORDER BY username
  LIMIT ${SEARCH_LIMIT}
`)
const findFriendshipById = db.prepare('SELECT * FROM friendships WHERE id = ?')
const findFriendshipBetween = db.prepare(`
  SELECT * FROM friendships
  WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
`)
const findFriends = db.prepare(`
  SELECT users.id, users.username, users.display_name, users.avatar_color, users.timezone
  FROM friendships JOIN users ON users.id = friendships.addressee_id
  WHERE friendships.requester_id = ? AND friendships.status = 'accepted'
  UNION ALL
  SELECT users.id, users.username, users.display_name, users.avatar_color, users.timezone
  FROM friendships JOIN users ON users.id = friendships.requester_id
  WHERE friendships.addressee_id = ? AND friendships.status = 'accepted'
  ORDER BY display_name COLLATE NOCASE, username
`)
const findIncomingRequests = db.prepare(`
  SELECT friendships.id, friendships.created_at, users.id AS user_id, users.username, users.display_name, users.avatar_color
  FROM friendships JOIN users ON users.id = friendships.requester_id
  WHERE friendships.addressee_id = ? AND friendships.status = 'pending'
  ORDER BY friendships.created_at DESC, friendships.id DESC
`)
const findOutgoingRequests = db.prepare(`
  SELECT friendships.id, friendships.created_at, users.id AS user_id, users.username, users.display_name, users.avatar_color
  FROM friendships JOIN users ON users.id = friendships.addressee_id
  WHERE friendships.requester_id = ? AND friendships.status = 'pending'
  ORDER BY friendships.created_at DESC, friendships.id DESC
`)
const insertRequest = db.prepare("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')")
const acceptRequest = db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?")
const deleteFriendship = db.prepare('DELETE FROM friendships WHERE id = ?')
const deleteFriendshipBetween = db.prepare(`
  DELETE FROM friendships
  WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
`)

export function areFriends(userIdA, userIdB) {
  const friendship = findFriendshipBetween.get(userIdA, userIdB, userIdB, userIdA)
  return Boolean(friendship && friendship.status === 'accepted')
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarColor: user.avatar_color,
  }
}

function friendGoalToJson(goal) {
  return {
    id: goal.id,
    title: goal.title,
    frequency: goal.frequency,
    timesPerWeek: goal.timesPerWeek,
    doneToday: goal.doneToday,
    weekCount: goal.weekCount,
    streak: goal.streak,
    target: goal.target,
    unit: goal.unit,
    amountToday: goal.amountToday,
    weekAmount: goal.weekAmount,
  }
}

function friendWithToday(friend, viewerId) {
  const { today, goals } = goalsWithStatus(friend)
  return {
    ...publicUser(friend),
    today: { done: goals.filter(isFinishedToday).length, total: goals.length },
    nudged: findSentNudge.get(friend.id, `nudge-${viewerId}`, today) !== undefined,
  }
}

function seasonStats(user, today) {
  const season = seasonRange(today)
  const rows = findSeasonCompletions.all(user.id, season.start, season.end)
  const datesByGoal = new Map()
  for (const row of rows.filter((item) => item.frequency === 'daily')) {
    datesByGoal.set(row.goal_id, [...(datesByGoal.get(row.goal_id) || []), row.completed_on])
  }
  let bestStreak = 0
  for (const dates of datesByGoal.values()) {
    bestStreak = Math.max(bestStreak, longestDailyRun(dates, season.start, season.end))
  }
  return { checkoffs: rows.length, bestStreak }
}

function userWithFriendship(user, viewerId) {
  const friendship = findFriendshipBetween.get(viewerId, user.id, user.id, viewerId)
  let state = 'none'
  if (friendship && friendship.status === 'accepted') {
    state = 'friends'
  } else if (friendship) {
    state = friendship.requester_id === viewerId ? 'outgoing' : 'incoming'
  }
  return {
    ...publicUser(user),
    friendship: state,
    requestId: state === 'incoming' || state === 'outgoing' ? friendship.id : null,
  }
}

function requestToJson(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    user: { id: row.user_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
  }
}

function findTargetUser(body) {
  if (body.userId !== undefined) {
    const userId = readId(body.userId, 'user')
    return userId.error ? userId : { value: findUserById.get(userId.value) }
  }
  const username = readUsername(body.username)
  return username.error ? username : { value: findUserByUsername.get(username.value) }
}

function loadPendingRequest(req, res) {
  const id = readId(req.params.id, 'request')
  if (id.error) {
    res.status(400).json({ error: id.error })
    return null
  }
  const request = findFriendshipById.get(id.value)
  if (!request || request.status !== 'pending') {
    res.status(404).json({ error: 'That friend request no longer exists' })
    return null
  }
  return request
}

const router = express.Router()

router.get('/users/search', requireAuth, (req, res) => {
  const query = readSearchQuery(req.query.q)
  if (query.error) {
    return res.status(400).json({ error: query.error })
  }
  if (query.value === '') {
    return res.json({ users: [] })
  }
  const users = searchUsers.all(`${query.value}*`, req.user.id)
  res.json({ users: users.map((user) => userWithFriendship(user, req.user.id)) })
})

router.get('/friends', requireAuth, (req, res) => {
  res.json({ friends: findFriends.all(req.user.id, req.user.id).map((friend) => friendWithToday(friend, req.user.id)) })
})

router.get('/friends/:userId/goals', requireAuth, (req, res) => {
  const friendId = readId(req.params.userId, 'user')
  if (friendId.error) {
    return res.status(400).json({ error: friendId.error })
  }
  if (!areFriends(req.user.id, friendId.value)) {
    return res.status(403).json({ error: 'You can only see goals of your friends' })
  }
  const friend = findUserWithTimezone.get(friendId.value)
  const { today, goals } = goalsWithStatus(friend)
  res.json({ user: publicUser(friend), today, goals: goals.map(friendGoalToJson) })
})

router.post('/friends/:userId/nudge', requireAuth, (req, res) => {
  const friendId = readId(req.params.userId, 'user')
  if (friendId.error) {
    return res.status(400).json({ error: friendId.error })
  }
  if (!areFriends(req.user.id, friendId.value)) {
    return res.status(403).json({ error: 'You can only nudge your friends' })
  }
  const friend = findFullUser.get(friendId.value)
  const { today, goals } = goalsWithStatus(friend)
  const left = goals.filter((goal) => !isFinishedToday(goal))
  if (left.length === 0) {
    return res.status(409).json({ error: goals.length === 0 ? 'They don’t have any goals yet' : 'They’re already done for today' })
  }
  if (!markSentOnce(friend.id, `nudge-${req.user.id}`, today)) {
    return res.status(409).json({ error: 'You already nudged them today' })
  }
  notifyNudge(req.user, friend, left)
  res.status(201).json({ nudged: true })
})

router.get('/people/:userId', requireAuth, (req, res) => {
  const personId = readId(req.params.userId, 'user')
  if (personId.error) {
    return res.status(400).json({ error: personId.error })
  }
  const isYou = personId.value === req.user.id
  if (!isYou && !areFriends(req.user.id, personId.value)) {
    return res.status(403).json({ error: 'You can only see profiles of your friends' })
  }
  const person = findFullUser.get(personId.value)
  const { today, goals } = goalsWithStatus(person)
  res.json({
    user: publicUser(person),
    isYou,
    today: { done: goals.filter(isFinishedToday).length, total: goals.length },
    goals: goals.map(friendGoalToJson),
    milestones: findMilestones.all(person.id).map((row) => ({
      id: row.id,
      streak: row.streak,
      reachedOn: row.reached_on,
      goal: { id: row.goal_id, title: row.title, frequency: row.frequency },
    })),
    stats: seasonStats(person, today),
  })
})

router.get('/friends/requests', requireAuth, (req, res) => {
  res.json({
    incoming: findIncomingRequests.all(req.user.id).map(requestToJson),
    outgoing: findOutgoingRequests.all(req.user.id).map(requestToJson),
  })
})

router.post('/friends/requests', requireAuth, (req, res) => {
  const target = findTargetUser(req.body)
  if (target.error) {
    return res.status(400).json({ error: target.error })
  }
  if (!target.value) {
    return res.status(404).json({ error: 'No one has that username' })
  }
  if (target.value.id === req.user.id) {
    return res.status(400).json({ error: 'You can’t add yourself as a friend' })
  }

  const existing = findFriendshipBetween.get(req.user.id, target.value.id, target.value.id, req.user.id)
  if (existing && existing.status === 'accepted') {
    return res.status(409).json({ error: 'You’re already friends' })
  }
  if (existing && existing.requester_id === req.user.id) {
    return res.status(409).json({ error: 'You already sent them a request' })
  }
  if (existing) {
    acceptRequest.run(existing.id)
    notifyFriendship(req.user.id, target.value.id)
    notifyRequestAccepted(req.user, target.value.id)
    return res.json({ user: userWithFriendship(target.value, req.user.id) })
  }

  try {
    insertRequest.run(req.user.id, target.value.id)
  } catch (insertError) {
    if (insertError.code === 'SQLITE_CONSTRAINT_CHECK') {
      return res.status(400).json({ error: 'You can’t add yourself as a friend' })
    }
    if (insertError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'There’s already a request between you two' })
    }
    throw insertError
  }
  notifyFriendship(req.user.id, target.value.id)
  notifyFriendRequest(req.user, target.value.id)
  res.status(201).json({ user: userWithFriendship(target.value, req.user.id) })
})

router.post('/friends/requests/:id/accept', requireAuth, (req, res) => {
  const request = loadPendingRequest(req, res)
  if (!request) {
    return
  }
  if (request.addressee_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the person who was asked can accept' })
  }
  acceptRequest.run(request.id)
  notifyFriendship(req.user.id, request.requester_id)
  notifyRequestAccepted(req.user, request.requester_id)
  res.json({ user: userWithFriendship(findUserById.get(request.requester_id), req.user.id) })
})

router.post('/friends/requests/:id/decline', requireAuth, (req, res) => {
  const request = loadPendingRequest(req, res)
  if (!request) {
    return
  }
  if (request.addressee_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the person who was asked can decline' })
  }
  deleteFriendship.run(request.id)
  notifyFriendship(req.user.id, request.requester_id)
  res.status(204).end()
})

router.delete('/friends/requests/:id', requireAuth, (req, res) => {
  const request = loadPendingRequest(req, res)
  if (!request) {
    return
  }
  if (request.requester_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the person who sent a request can cancel it' })
  }
  deleteFriendship.run(request.id)
  notifyFriendship(req.user.id, request.addressee_id)
  res.status(204).end()
})

router.delete('/friends/:userId', requireAuth, (req, res) => {
  const friendId = readId(req.params.userId, 'user')
  if (friendId.error) {
    return res.status(400).json({ error: friendId.error })
  }
  if (!areFriends(req.user.id, friendId.value)) {
    return res.status(404).json({ error: 'You aren’t friends with that person' })
  }
  deleteFriendshipBetween.run(req.user.id, friendId.value, friendId.value, req.user.id)
  notifyFriendship(req.user.id, friendId.value)
  res.status(204).end()
})

export default router
