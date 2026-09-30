import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { todayInTimezone, seasonRange, buildHistory } from './dates.js'

const findAllGoals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY position, id')
const findCompletions = db.prepare(`
  SELECT completions.goal_id, completions.completed_on
  FROM completions
  JOIN goals ON goals.id = completions.goal_id
  WHERE goals.user_id = ?
  ORDER BY completions.completed_on
`)

function dateOf(timestamp, timezone) {
  return timestamp ? todayInTimezone(timezone, new Date(timestamp)) : null
}

function historyForUser(user) {
  const today = todayInTimezone(user.timezone)
  const season = seasonRange(today)
  const completions = findCompletions.all(user.id)

  let firstDay = season.start
  const joinedOn = dateOf(user.created_at, user.timezone)
  if (joinedOn < firstDay) {
    firstDay = joinedOn
  }
  if (completions.length > 0 && completions[0].completed_on < firstDay) {
    firstDay = completions[0].completed_on
  }

  const goals = findAllGoals.all(user.id).map((goal) => ({
    id: goal.id,
    title: goal.title,
    frequency: goal.frequency,
    timesPerWeek: goal.times_per_week,
    archived: !goal.is_active,
    startDate: dateOf(goal.created_at, user.timezone),
    endDate: dateOf(goal.archived_at, user.timezone),
    dates: completions.filter((row) => row.goal_id === goal.id).map((row) => row.completed_on),
  }))

  const weeks = buildHistory(goals, firstDay, season.end, today)
  const usedIds = new Set()
  for (const week of weeks) {
    week.goals.forEach((result) => usedIds.add(result.id))
    for (const day of week.days) {
      day.done.forEach((id) => usedIds.add(id))
      day.missed.forEach((id) => usedIds.add(id))
      day.weeklyDone.forEach((id) => usedIds.add(id))
    }
  }

  return {
    today,
    firstDay,
    lastDay: season.end,
    goals: goals
      .filter((goal) => usedIds.has(goal.id))
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        frequency: goal.frequency,
        timesPerWeek: goal.timesPerWeek,
        archived: goal.archived,
      })),
    weeks,
  }
}

const router = express.Router()

router.get('/history', requireAuth, (req, res) => {
  res.json(historyForUser(req.user))
})

export default router
