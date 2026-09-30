import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { readGoalTitle, readFrequency, readTimesPerWeek, firstError } from './validation.js'
import {
  todayInTimezone,
  addDays,
  isAllowedCompletionDate,
  countInWeek,
  dailyStreak,
  weeklyStreak,
} from './dates.js'

const MAX_ACTIVE_GOALS = 30

const findGoal = db.prepare('SELECT * FROM goals WHERE id = ?')
const findActiveGoals = db.prepare('SELECT * FROM goals WHERE user_id = ? AND is_active = 1 ORDER BY created_at, id')
const countActiveGoals = db.prepare('SELECT count(*) AS count FROM goals WHERE user_id = ? AND is_active = 1')
const findCompletionsForUser = db.prepare(`
  SELECT completions.goal_id, completions.completed_on
  FROM completions
  JOIN goals ON goals.id = completions.goal_id
  WHERE goals.user_id = ? AND goals.is_active = 1
`)
const findCompletionsForGoal = db.prepare('SELECT completed_on FROM completions WHERE goal_id = ?')
const insertGoal = db.prepare('INSERT INTO goals (user_id, title, frequency, times_per_week) VALUES (?, ?, ?, ?)')
const updateGoal = db.prepare('UPDATE goals SET title = ?, frequency = ?, times_per_week = ? WHERE id = ?')
const archiveGoal = db.prepare('UPDATE goals SET is_active = 0 WHERE id = ?')
const insertCompletion = db.prepare(`
  INSERT INTO completions (goal_id, user_id, completed_on) VALUES (?, ?, ?)
  ON CONFLICT (goal_id, completed_on) DO NOTHING
`)
const deleteCompletion = db.prepare('DELETE FROM completions WHERE goal_id = ? AND completed_on = ?')

function goalToJson(goal, completedDates, today) {
  const isDaily = goal.frequency === 'daily'
  return {
    id: goal.id,
    title: goal.title,
    frequency: goal.frequency,
    timesPerWeek: goal.times_per_week,
    createdAt: goal.created_at,
    doneToday: completedDates.includes(today),
    doneYesterday: completedDates.includes(addDays(today, -1)),
    weekCount: isDaily ? null : countInWeek(completedDates, today),
    streak: isDaily ? dailyStreak(completedDates, today) : weeklyStreak(completedDates, goal.times_per_week, today),
  }
}

export function goalsWithStatus(user) {
  const today = todayInTimezone(user.timezone)
  const datesByGoal = new Map()
  for (const row of findCompletionsForUser.all(user.id)) {
    if (!datesByGoal.has(row.goal_id)) {
      datesByGoal.set(row.goal_id, [])
    }
    datesByGoal.get(row.goal_id).push(row.completed_on)
  }
  return {
    today,
    yesterday: addDays(today, -1),
    goals: findActiveGoals.all(user.id).map((goal) => goalToJson(goal, datesByGoal.get(goal.id) || [], today)),
  }
}

export function singleGoalWithStatus(goal, user) {
  const today = todayInTimezone(user.timezone)
  const dates = findCompletionsForGoal.all(goal.id).map((row) => row.completed_on)
  return goalToJson(goal, dates, today)
}

function loadOwnActiveGoal(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid goal id' })
    return null
  }
  const goal = findGoal.get(id)
  if (!goal) {
    res.status(404).json({ error: 'Goal not found' })
    return null
  }
  if (goal.user_id !== req.user.id) {
    res.status(403).json({ error: 'You can only change your own goals' })
    return null
  }
  if (!goal.is_active) {
    res.status(404).json({ error: 'That goal is archived' })
    return null
  }
  return goal
}

function readCompletionDate(req, res) {
  const date = req.body.date !== undefined ? req.body.date : req.query.date
  if (!isAllowedCompletionDate(date, req.user.timezone)) {
    res.status(400).json({ error: 'You can only check off goals for today or yesterday' })
    return null
  }
  return date
}

const router = express.Router()

router.get('/goals', requireAuth, (req, res) => {
  res.json(goalsWithStatus(req.user))
})

router.post('/goals', requireAuth, (req, res) => {
  const title = readGoalTitle(req.body.title)
  const frequency = readFrequency(req.body.frequency)
  const timesPerWeek = frequency.error ? { value: null } : readTimesPerWeek(frequency.value, req.body.timesPerWeek)
  const error = firstError([title, frequency, timesPerWeek])
  if (error) {
    return res.status(400).json({ error })
  }
  if (countActiveGoals.get(req.user.id).count >= MAX_ACTIVE_GOALS) {
    return res.status(400).json({ error: `You can have up to ${MAX_ACTIVE_GOALS} active goals` })
  }

  const result = insertGoal.run(req.user.id, title.value, frequency.value, timesPerWeek.value)
  res.status(201).json({ goal: singleGoalWithStatus(findGoal.get(result.lastInsertRowid), req.user) })
})

router.patch('/goals/:id', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  const { title: newTitle, frequency: newFrequency, timesPerWeek: newTimesPerWeek } = req.body
  if (newTitle === undefined && newFrequency === undefined && newTimesPerWeek === undefined) {
    return res.status(400).json({ error: 'Nothing to update' })
  }

  const title = newTitle !== undefined ? readGoalTitle(newTitle) : { value: goal.title }
  const frequency = newFrequency !== undefined ? readFrequency(newFrequency) : { value: goal.frequency }
  let timesPerWeek = { value: null }
  if (!frequency.error) {
    const keepsWeeklyCount = frequency.value === 'weekly' && newTimesPerWeek === undefined && goal.frequency === 'weekly'
    timesPerWeek = keepsWeeklyCount ? { value: goal.times_per_week } : readTimesPerWeek(frequency.value, newTimesPerWeek)
  }
  const error = firstError([title, frequency, timesPerWeek])
  if (error) {
    return res.status(400).json({ error })
  }

  updateGoal.run(title.value, frequency.value, timesPerWeek.value, goal.id)
  res.json({ goal: singleGoalWithStatus(findGoal.get(goal.id), req.user) })
})

router.post('/goals/:id/archive', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  archiveGoal.run(goal.id)
  res.status(204).end()
})

router.post('/goals/:id/complete', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  const date = readCompletionDate(req, res)
  if (!date) {
    return
  }
  const result = insertCompletion.run(goal.id, req.user.id, date)
  res.status(result.changes === 1 ? 201 : 200).json({ goal: singleGoalWithStatus(goal, req.user) })
})

router.delete('/goals/:id/complete', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  const date = readCompletionDate(req, res)
  if (!date) {
    return
  }
  deleteCompletion.run(goal.id, date)
  res.json({ goal: singleGoalWithStatus(goal, req.user) })
})

export default router
