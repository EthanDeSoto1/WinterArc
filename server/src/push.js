import express from 'express'
import webpush from 'web-push'
import db from './db.js'
import { requireAuth } from './auth.js'
import { readPushEndpoint, readPushSubscription, readSwitch, readReminderHour, firstError } from './validation.js'

const MAX_DEVICES_PER_USER = 10
const DAY_SECONDS = 24 * 60 * 60
const REACTION_EMOJI = { fire: '🔥', muscle: '💪', clap: '👏' }
const SETTING_COLUMNS = {
  posts: 'notify_posts',
  myPosts: 'notify_my_posts',
  friendDone: 'notify_friend_done',
  friendGoals: 'notify_friend_goals',
  friendRequests: 'notify_friend_requests',
  remindMorning: 'remind_morning',
  remindMidday: 'remind_midday',
  remindEvening: 'remind_evening',
}
const REMINDER_HOURS = {
  remindMorningHour: { column: 'remind_morning_hour', earliest: 5, latest: 10 },
  remindMiddayHour: { column: 'remind_midday_hour', earliest: 11, latest: 16 },
  remindEveningHour: { column: 'remind_evening_hour', earliest: 17, latest: 23 },
}

const publicKey = process.env.VAPID_PUBLIC_KEY || ''
const privateKey = process.env.VAPID_PRIVATE_KEY || ''
const pushEnabled = publicKey !== '' && privateKey !== ''
if (pushEnabled) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://github.com/EthanDeSoto1/WinterArc', publicKey, privateKey)
} else {
  console.log('Push notifications are off: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set.')
}

const findUser = db.prepare('SELECT * FROM users WHERE id = ?')
const findSubscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
const saveSubscription = db.prepare(`
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
  ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
`)
const deleteExtraSubscriptions = db.prepare(`
  DELETE FROM push_subscriptions
  WHERE user_id = ? AND id NOT IN (SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT ${MAX_DEVICES_PER_USER})
`)
const deleteOwnSubscription = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
const deleteSubscription = db.prepare('DELETE FROM push_subscriptions WHERE id = ?')
const insertSent = db.prepare('INSERT INTO sent_notifications (user_id, kind, day) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
const deleteOldSent = db.prepare("DELETE FROM sent_notifications WHERE day < date('now', '-7 days')")
const findPostReaders = db.prepare(`
  SELECT DISTINCT users.id FROM users
  JOIN push_subscriptions ON push_subscriptions.user_id = users.id
  WHERE users.notify_posts = 1 AND users.id != ?
`)
const friendsWhere = `
  users.id IN (
    SELECT addressee_id FROM friendships WHERE requester_id = ? AND status = 'accepted'
    UNION
    SELECT requester_id FROM friendships WHERE addressee_id = ? AND status = 'accepted'
  )
`
const findFriendsWantingDone = db.prepare(`SELECT id FROM users WHERE notify_friend_done = 1 AND ${friendsWhere}`)
const findFriendsWantingGoals = db.prepare(`SELECT id FROM users WHERE notify_friend_goals = 1 AND ${friendsWhere}`)

const updateSetting = {}
for (const [key, column] of Object.entries(SETTING_COLUMNS)) {
  updateSetting[key] = db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`)
}
for (const [key, hour] of Object.entries(REMINDER_HOURS)) {
  updateSetting[key] = db.prepare(`UPDATE users SET ${hour.column} = ? WHERE id = ?`)
}

function settingsToJson(user) {
  const settings = {}
  for (const [key, column] of Object.entries(SETTING_COLUMNS)) {
    settings[key] = user[column] === 1
  }
  for (const [key, hour] of Object.entries(REMINDER_HOURS)) {
    settings[key] = user[hour.column]
  }
  return settings
}

function readSetting(key, value) {
  if (Object.hasOwn(REMINDER_HOURS, key)) {
    return readReminderHour(value, REMINDER_HOURS[key].earliest, REMINDER_HOURS[key].latest)
  }
  return readSwitch(value)
}

function preview(text, length = 120) {
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text
}

export function sendToUser(userId, message, ttl = DAY_SECONDS / 2) {
  if (!pushEnabled) {
    return
  }
  const payload = JSON.stringify(message)
  for (const subscription of findSubscriptions.all(userId)) {
    const target = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }
    webpush.sendNotification(target, payload, { TTL: ttl }).catch((error) => {
      if (error.statusCode === 404 || error.statusCode === 410) {
        deleteSubscription.run(subscription.id)
      } else {
        console.error(`Push to ${new URL(subscription.endpoint).hostname} failed: ${error.statusCode || ''} ${error.body || error.message}`)
      }
    })
  }
}

export function markSentOnce(userId, kind, day) {
  return insertSent.run(userId, kind, day).changes === 1
}

export function deleteOldSentNotifications() {
  deleteOldSent.run()
}

export function notifyNewPost(author, body, hasPhoto) {
  const message = {
    title: `${author.display_name} posted on the Board`,
    body: body ? preview(body) : hasPhoto ? 'Shared a photo' : '',
    url: '/board',
  }
  for (const reader of findPostReaders.all(author.id)) {
    sendToUser(reader.id, message)
  }
}

export function notifyReaction(post, reactor, kind) {
  const owner = findUser.get(post.user_id)
  if (owner.id === reactor.id || owner.notify_my_posts !== 1) {
    return
  }
  sendToUser(owner.id, {
    title: `${reactor.display_name} reacted ${REACTION_EMOJI[kind]} to your post`,
    body: post.body ? preview(post.body) : 'Your photo',
    url: '/board',
  })
}

export function notifyComment(post, commenter, comment) {
  const owner = findUser.get(post.user_id)
  if (owner.id === commenter.id || owner.notify_my_posts !== 1) {
    return
  }
  sendToUser(owner.id, {
    title: `${commenter.display_name} commented on your post`,
    body: preview(comment),
    url: '/board',
  })
}

export function notifyCheckoff(user, goal, date, isToday) {
  if (!markSentOnce(user.id, `goal-${goal.id}`, date)) {
    return
  }
  const message = {
    title: `${user.display_name} completed ${goal.title}`,
    body: isToday ? 'Checked off just now' : 'Checked off for yesterday',
    url: '/friends',
  }
  for (const friend of findFriendsWantingGoals.all(user.id, user.id)) {
    sendToUser(friend.id, message)
  }
}

export function notifyFriendRequest(sender, receiverId) {
  const receiver = findUser.get(receiverId)
  if (receiver.notify_friend_requests !== 1) {
    return
  }
  sendToUser(receiver.id, {
    title: `${sender.display_name} sent you a friend request`,
    body: `@${sender.username} wants to follow your Winter Arc`,
    url: '/friends?add=1',
  })
}

export function notifyRequestAccepted(accepter, requesterId) {
  const requester = findUser.get(requesterId)
  if (requester.notify_friend_requests !== 1) {
    return
  }
  sendToUser(requester.id, {
    title: `${accepter.display_name} accepted your friend request`,
    body: 'You can now see each other’s goals',
    url: '/friends',
  })
}

export function notifyDayDone(user, goalCount, today) {
  if (!markSentOnce(user.id, 'day-done', today)) {
    return
  }
  const message = {
    title: `${user.display_name} finished the day`,
    body: `All ${goalCount} ${goalCount === 1 ? 'goal' : 'goals'} done today`,
    url: '/friends',
  }
  for (const friend of findFriendsWantingDone.all(user.id, user.id)) {
    sendToUser(friend.id, message)
  }
}

const router = express.Router()

router.get('/push', requireAuth, (req, res) => {
  res.json({
    publicKey: pushEnabled ? publicKey : null,
    devices: findSubscriptions.all(req.user.id).length,
    settings: settingsToJson(req.user),
  })
})

router.post('/push/subscriptions', requireAuth, (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({ error: 'Notifications are not set up on the server yet' })
  }
  const subscription = readPushSubscription(req.body)
  if (subscription.error) {
    return res.status(400).json({ error: subscription.error })
  }
  const { endpoint, p256dh, auth } = subscription.value
  saveSubscription.run(req.user.id, endpoint, p256dh, auth)
  deleteExtraSubscriptions.run(req.user.id, req.user.id)
  res.status(201).json({ devices: findSubscriptions.all(req.user.id).length })
})

router.delete('/push/subscriptions', requireAuth, (req, res) => {
  const endpoint = readPushEndpoint(req.body.endpoint)
  if (endpoint.error) {
    return res.status(400).json({ error: endpoint.error })
  }
  deleteOwnSubscription.run(endpoint.value, req.user.id)
  res.status(204).end()
})

router.patch('/push/settings', requireAuth, (req, res) => {
  const keys = Object.keys(req.body)
  if (keys.length === 0) {
    return res.status(400).json({ error: 'Nothing to update' })
  }
  if (keys.some((key) => !Object.hasOwn(SETTING_COLUMNS, key) && !Object.hasOwn(REMINDER_HOURS, key))) {
    return res.status(400).json({ error: 'Unknown notification setting' })
  }
  const values = keys.map((key) => readSetting(key, req.body[key]))
  const error = firstError(values)
  if (error) {
    return res.status(400).json({ error })
  }
  keys.forEach((key, index) => {
    updateSetting[key].run(values[index].value, req.user.id)
  })
  res.json({ settings: settingsToJson(findUser.get(req.user.id)) })
})

router.post('/push/test', requireAuth, (req, res) => {
  const devices = findSubscriptions.all(req.user.id).length
  if (!pushEnabled || devices === 0) {
    return res.status(400).json({ error: 'Turn on notifications on this device first' })
  }
  sendToUser(req.user.id, { title: 'Winter Arc', body: 'Notifications are working.', url: '/account' }, 60 * 60)
  res.json({ devices })
})

export default router
