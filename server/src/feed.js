import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { notifyActivity } from './events.js'
import { notifyCheer } from './push.js'
import { areFriends, publicUser } from './friends.js'
import { readId } from './validation.js'
import { todayInTimezone, addDays } from './dates.js'

const FEED_LIMIT = 50

const itemColumns = `
  SELECT completions.id, completions.completed_on, completions.completed_at,
    goals.id AS goal_id, goals.title, goals.frequency,
    users.id AS user_id, users.username, users.display_name, users.avatar_color, users.timezone
  FROM completions
  JOIN goals ON goals.id = completions.goal_id
  JOIN users ON users.id = completions.user_id
`
const findFeed = db.prepare(`
  ${itemColumns}
  WHERE completions.user_id = ?
    OR completions.user_id IN (
      SELECT addressee_id FROM friendships WHERE requester_id = ? AND status = 'accepted'
      UNION
      SELECT requester_id FROM friendships WHERE addressee_id = ? AND status = 'accepted'
    )
  ORDER BY completions.completed_at DESC, completions.id DESC
  LIMIT ${FEED_LIMIT}
`)
const findItem = db.prepare(`${itemColumns} WHERE completions.id = ?`)
const findCheers = db.prepare(`
  SELECT cheers.completion_id, users.id, users.username, users.display_name, users.avatar_color
  FROM cheers
  JOIN users ON users.id = cheers.user_id
  WHERE cheers.completion_id IN (SELECT value FROM json_each(?))
  ORDER BY cheers.created_at, cheers.user_id
`)
const findMilestones = db.prepare(`
  SELECT goal_id, reached_on, max(streak) AS streak
  FROM milestones
  WHERE goal_id IN (SELECT value FROM json_each(?))
  GROUP BY goal_id, reached_on
`)
const insertCheer = db.prepare('INSERT INTO cheers (completion_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
const deleteCheer = db.prepare('DELETE FROM cheers WHERE completion_id = ? AND user_id = ?')

function itemsToJson(rows, viewer) {
  const cheerRows = findCheers.all(JSON.stringify(rows.map((row) => row.id)))
  const milestoneRows = findMilestones.all(JSON.stringify([...new Set(rows.map((row) => row.goal_id))]))
  return rows.map((row) => {
    const completedAt = new Date(row.completed_at)
    const people = cheerRows.filter((cheer) => cheer.completion_id === row.id)
    const milestone = milestoneRows.find((item) => item.goal_id === row.goal_id && item.reached_on === row.completed_on)
    return {
      id: row.id,
      completedAt: row.completed_at,
      day: todayInTimezone(viewer.timezone, completedAt),
      forYesterday: row.completed_on !== todayInTimezone(row.timezone, completedAt),
      user: { id: row.user_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
      goal: { id: row.goal_id, title: row.title, frequency: row.frequency },
      milestone: milestone ? milestone.streak : null,
      cheers: people.map(publicUser),
      cheeredByMe: people.some((person) => person.id === viewer.id),
      canCheer: row.user_id !== viewer.id,
    }
  })
}

function loadCheerTarget(req, res) {
  const id = readId(req.params.id, 'check-off')
  if (id.error) {
    res.status(400).json({ error: id.error })
    return null
  }
  const item = findItem.get(id.value)
  if (!item || (item.user_id !== req.user.id && !areFriends(item.user_id, req.user.id))) {
    res.status(404).json({ error: 'That check-off no longer exists' })
    return null
  }
  if (item.user_id === req.user.id) {
    res.status(400).json({ error: 'You can’t cheer your own check-off' })
    return null
  }
  return item
}

const router = express.Router()

router.get('/feed', requireAuth, (req, res) => {
  const today = todayInTimezone(req.user.timezone)
  const rows = findFeed.all(req.user.id, req.user.id, req.user.id)
  res.json({
    today,
    yesterday: addDays(today, -1),
    items: itemsToJson(rows, req.user),
  })
})

router.put('/feed/:id/cheer', requireAuth, (req, res) => {
  const item = loadCheerTarget(req, res)
  if (!item) {
    return
  }
  if (insertCheer.run(item.id, req.user.id).changes === 1) {
    notifyActivity(item.user_id)
    notifyCheer(req.user, item.user_id, item.title)
  }
  res.json({ item: itemsToJson([item], req.user)[0] })
})

router.delete('/feed/:id/cheer', requireAuth, (req, res) => {
  const item = loadCheerTarget(req, res)
  if (!item) {
    return
  }
  if (deleteCheer.run(item.id, req.user.id).changes === 1) {
    notifyActivity(item.user_id)
  }
  res.json({ item: itemsToJson([item], req.user)[0] })
})

export default router
