import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'

const HEARTBEAT_MS = 25000
const MAX_CONNECTIONS_PER_USER = 10

const findFriendIds = db.prepare(`
  SELECT addressee_id AS id FROM friendships WHERE requester_id = ? AND status = 'accepted'
  UNION
  SELECT requester_id AS id FROM friendships WHERE addressee_id = ? AND status = 'accepted'
`)

const connectionsByUser = new Map()

function sendTo(userId, eventName, data) {
  const connections = connectionsByUser.get(userId)
  if (!connections) {
    return
  }
  const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of connections) {
    res.write(message)
  }
}

function sendToUserAndFriends(userId, eventName) {
  const friendIds = findFriendIds.all(userId, userId).map((row) => row.id)
  for (const id of [userId, ...friendIds]) {
    sendTo(id, eventName, { userId })
  }
}

export function notifyActivity(userId) {
  sendToUserAndFriends(userId, 'activity')
}

export function notifyBoard(userId) {
  sendToUserAndFriends(userId, 'board')
}

export function closeAllStreams() {
  for (const connections of connectionsByUser.values()) {
    for (const res of connections) {
      res.end()
    }
  }
}

setInterval(() => {
  for (const connections of connectionsByUser.values()) {
    for (const res of connections) {
      res.write(': heartbeat\n\n')
    }
  }
}, HEARTBEAT_MS).unref()

const router = express.Router()

router.get('/events', requireAuth, (req, res) => {
  const userId = req.user.id
  const connections = connectionsByUser.get(userId) || new Set()
  if (connections.size >= MAX_CONNECTIONS_PER_USER) {
    return res.status(429).json({ error: 'Too many open connections' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 5000\n\n')

  connections.add(res)
  connectionsByUser.set(userId, connections)

  req.on('close', () => {
    connections.delete(res)
    if (connections.size === 0) {
      connectionsByUser.delete(userId)
    }
  })
})

export default router
