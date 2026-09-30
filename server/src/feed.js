import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { todayInTimezone, addDays } from './dates.js'

const FEED_LIMIT = 50

const findFeed = db.prepare(`
  SELECT completions.id, completions.completed_on, completions.completed_at,
    goals.id AS goal_id, goals.title, goals.frequency,
    users.id AS user_id, users.username, users.display_name, users.avatar_color, users.timezone
  FROM completions
  JOIN goals ON goals.id = completions.goal_id
  JOIN users ON users.id = completions.user_id
  WHERE completions.user_id = ?
    OR completions.user_id IN (
      SELECT addressee_id FROM friendships WHERE requester_id = ? AND status = 'accepted'
      UNION
      SELECT requester_id FROM friendships WHERE addressee_id = ? AND status = 'accepted'
    )
  ORDER BY completions.completed_at DESC, completions.id DESC
  LIMIT ${FEED_LIMIT}
`)

function feedItemToJson(row, viewer) {
  const completedAt = new Date(row.completed_at)
  return {
    id: row.id,
    completedAt: row.completed_at,
    day: todayInTimezone(viewer.timezone, completedAt),
    forYesterday: row.completed_on !== todayInTimezone(row.timezone, completedAt),
    user: { id: row.user_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
    goal: { id: row.goal_id, title: row.title, frequency: row.frequency },
  }
}

const router = express.Router()

router.get('/feed', requireAuth, (req, res) => {
  const today = todayInTimezone(req.user.timezone)
  const rows = findFeed.all(req.user.id, req.user.id, req.user.id)
  res.json({
    today,
    yesterday: addDays(today, -1),
    items: rows.map((row) => feedItemToJson(row, req.user)),
  })
})

export default router
