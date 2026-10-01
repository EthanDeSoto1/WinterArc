import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { notifyActivity } from './events.js'
import { notifyCheckoff, notifyDayDone } from './push.js'
import {
  readGoalTitle,
  readFrequency,
  readTimesPerWeek,
  readGoalIds,
  readGoalTarget,
  readUnit,
  readAmount,
  readId,
  firstError,
} from './validation.js'
import {
  todayInTimezone,
  addDays,
  weekStart,
  isAllowedCompletionDate,
  countInWeek,
  dailyStreak,
  weeklyStreak,
} from './dates.js'

const MAX_ACTIVE_GOALS = 30
export const DAILY_MILESTONES = [7, 30, 60, 92]
export const WEEKLY_MILESTONES = [4, 8, 13]

const findGoal = db.prepare('SELECT * FROM goals WHERE id = ?')
const findActiveGoals = db.prepare('SELECT * FROM goals WHERE user_id = ? AND is_active = 1 ORDER BY position, id')
const countActiveGoals = db.prepare('SELECT count(*) AS count FROM goals WHERE user_id = ? AND is_active = 1')
const findCompletionsForUser = db.prepare(`
  SELECT completions.goal_id, completions.completed_on
  FROM completions
  JOIN goals ON goals.id = completions.goal_id
  WHERE goals.user_id = ? AND goals.is_active = 1
`)
const findCompletionsForGoal = db.prepare('SELECT completed_on FROM completions WHERE goal_id = ?')
const findAmountsForUser = db.prepare(`
  SELECT goal_amounts.goal_id, goal_amounts.logged_on, goal_amounts.amount
  FROM goal_amounts
  JOIN goals ON goals.id = goal_amounts.goal_id
  WHERE goals.user_id = ? AND goals.is_active = 1 AND goal_amounts.logged_on >= ?
`)
const findAmountsForGoal = db.prepare('SELECT logged_on, amount FROM goal_amounts WHERE goal_id = ? AND logged_on >= ?')
const sumAmounts = db.prepare(
  'SELECT coalesce(sum(amount), 0) AS total FROM goal_amounts WHERE goal_id = ? AND logged_on BETWEEN ? AND ?'
)
const saveAmount = db.prepare(`
  INSERT INTO goal_amounts (goal_id, logged_on, amount) VALUES (?, ?, ?)
  ON CONFLICT (goal_id, logged_on) DO UPDATE SET amount = excluded.amount
`)
const deleteAmount = db.prepare('DELETE FROM goal_amounts WHERE goal_id = ? AND logged_on = ?')
const insertGoal = db.prepare(`
  INSERT INTO goals (user_id, title, frequency, times_per_week, target, unit, position)
  VALUES (?, ?, ?, ?, ?, ?, (SELECT coalesce(max(position), 0) + 1 FROM goals WHERE user_id = ?))
`)
const updatePosition = db.prepare('UPDATE goals SET position = ? WHERE id = ?')
const saveOrder = db.transaction((goalIds) => {
  goalIds.forEach((goalId, index) => updatePosition.run(index + 1, goalId))
})
const updateGoal = db.prepare(
  'UPDATE goals SET title = ?, frequency = ?, times_per_week = ?, target = ?, unit = ? WHERE id = ?'
)
const archiveGoal = db.prepare(
  "UPDATE goals SET is_active = 0, archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
)
const findArchivedGoals = db.prepare(
  'SELECT * FROM goals WHERE user_id = ? AND is_active = 0 ORDER BY archived_at DESC, id DESC'
)
const restoreGoal = db.prepare(`
  UPDATE goals SET is_active = 1, archived_at = NULL,
    position = (SELECT coalesce(max(position), 0) + 1 FROM goals WHERE user_id = ? AND is_active = 1)
  WHERE id = ?
`)
const insertCompletion = db.prepare(`
  INSERT INTO completions (goal_id, user_id, completed_on) VALUES (?, ?, ?)
  ON CONFLICT (goal_id, completed_on) DO NOTHING
`)
const deleteCompletion = db.prepare('DELETE FROM completions WHERE goal_id = ? AND completed_on = ?')
const findCompletionOn = db.prepare('SELECT id FROM completions WHERE goal_id = ? AND completed_on = ?')
const findCompletionsBetween = db.prepare(
  'SELECT id FROM completions WHERE goal_id = ? AND completed_on BETWEEN ? AND ?'
)
const deleteCompletionsBetween = db.prepare(
  'DELETE FROM completions WHERE goal_id = ? AND completed_on BETWEEN ? AND ?'
)
const insertMilestone = db.prepare(
  'INSERT INTO milestones (user_id, goal_id, streak, reached_on) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING'
)
const deleteBrokenMilestones = db.prepare('DELETE FROM milestones WHERE goal_id = ? AND streak > ? AND reached_on >= ?')

function totalBetween(rows, from, to) {
  const total = rows.filter((row) => row.logged_on >= from && row.logged_on <= to).reduce((sum, row) => sum + row.amount, 0)
  return Math.round(total * 100) / 100
}

function amountFields(goal, rows, today) {
  if (goal.target === null) {
    return { target: null, unit: null, amountToday: null, amountYesterday: null, weekAmount: null, weekAmountYesterday: null }
  }
  const yesterday = addDays(today, -1)
  const thisWeek = weekStart(today)
  const lastWeek = weekStart(yesterday)
  return {
    target: goal.target,
    unit: goal.unit || '',
    amountToday: totalBetween(rows, today, today),
    amountYesterday: totalBetween(rows, yesterday, yesterday),
    weekAmount: totalBetween(rows, thisWeek, addDays(thisWeek, 6)),
    weekAmountYesterday: totalBetween(rows, lastWeek, addDays(lastWeek, 6)),
  }
}

function goalToJson(goal, completedDates, today, amountRows) {
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
    ...amountFields(goal, amountRows, today),
  }
}

function groupByGoal(rows) {
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row.goal_id)) {
      groups.set(row.goal_id, [])
    }
    groups.get(row.goal_id).push(row)
  }
  return groups
}

export function goalsWithStatus(user) {
  const today = todayInTimezone(user.timezone)
  const datesByGoal = groupByGoal(findCompletionsForUser.all(user.id))
  const amountsByGoal = groupByGoal(findAmountsForUser.all(user.id, weekStart(addDays(today, -1))))
  return {
    today,
    yesterday: addDays(today, -1),
    goals: findActiveGoals.all(user.id).map((goal) =>
      goalToJson(
        goal,
        (datesByGoal.get(goal.id) || []).map((row) => row.completed_on),
        today,
        amountsByGoal.get(goal.id) || []
      )
    ),
  }
}

export function isFinishedToday(goal) {
  return goal.doneToday || (goal.frequency === 'weekly' && goal.weekCount >= goal.timesPerWeek)
}

export function singleGoalWithStatus(goal, user) {
  const today = todayInTimezone(user.timezone)
  const dates = findCompletionsForGoal.all(goal.id).map((row) => row.completed_on)
  return goalToJson(goal, dates, today, findAmountsForGoal.all(goal.id, weekStart(addDays(today, -1))))
}

function milestonesFor(goal) {
  return goal.frequency === 'daily' ? DAILY_MILESTONES : WEEKLY_MILESTONES
}

function afterCompletionAdded(user, goal, date, streakBefore) {
  notifyActivity(user.id)
  const status = goalsWithStatus(user)
  notifyCheckoff(user, goal, date, date === status.today)
  if (date === status.today && status.goals.every(isFinishedToday)) {
    notifyDayDone(user, status.goals.length, status.today)
  }
  const streakAfter = status.goals.find((item) => item.id === goal.id).streak
  let reached = null
  for (const milestone of milestonesFor(goal)) {
    if (streakBefore < milestone && streakAfter >= milestone) {
      insertMilestone.run(user.id, goal.id, milestone, date)
      reached = milestone
    }
  }
  return reached
}

function afterCompletionRemoved(user, goal) {
  notifyActivity(user.id)
  const current = singleGoalWithStatus(goal, user)
  const yesterday = addDays(todayInTimezone(user.timezone), -1)
  const since = goal.frequency === 'daily' ? yesterday : weekStart(yesterday)
  deleteBrokenMilestones.run(goal.id, current.streak, since)
}

function syncAmountCompletion(goal, user, date) {
  if (goal.frequency === 'daily') {
    const reached = sumAmounts.get(goal.id, date, date).total >= goal.target
    const exists = findCompletionOn.get(goal.id, date) !== undefined
    if (reached && !exists) {
      insertCompletion.run(goal.id, user.id, date)
      return 'added'
    }
    if (!reached && exists) {
      deleteCompletion.run(goal.id, date)
      return 'removed'
    }
    return null
  }
  const monday = weekStart(date)
  const sunday = addDays(monday, 6)
  const reached = sumAmounts.get(goal.id, monday, sunday).total >= goal.target
  const existing = findCompletionsBetween.all(goal.id, monday, sunday)
  if (reached && existing.length === 0) {
    insertCompletion.run(goal.id, user.id, date)
    return 'added'
  }
  if (!reached && existing.length > 0) {
    deleteCompletionsBetween.run(goal.id, monday, sunday)
    return 'removed'
  }
  return null
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

function readGoalFields(body, goal) {
  const title = body.title !== undefined || !goal ? readGoalTitle(body.title) : { value: goal.title }
  const frequency = body.frequency !== undefined || !goal ? readFrequency(body.frequency) : { value: goal.frequency }
  const target = body.target !== undefined || !goal ? readGoalTarget(body.target) : { value: goal.target }
  if (frequency.error || target.error) {
    return { error: firstError([title, frequency, target]) }
  }
  const keepsWeeklyCount =
    goal && body.timesPerWeek === undefined && goal.frequency === 'weekly' && goal.target === null
  let timesPerWeek
  if (frequency.value === 'weekly' && target.value !== null) {
    timesPerWeek = { value: 1 }
  } else if (frequency.value === 'weekly' && keepsWeeklyCount) {
    timesPerWeek = { value: goal.times_per_week }
  } else {
    timesPerWeek = readTimesPerWeek(frequency.value, body.timesPerWeek)
  }
  const unitInput = body.unit !== undefined || !goal ? body.unit : goal.unit
  const unit = readUnit(unitInput, target.value)
  const error = firstError([title, timesPerWeek, unit])
  if (error) {
    return { error }
  }
  return { title: title.value, frequency: frequency.value, timesPerWeek: timesPerWeek.value, target: target.value, unit: unit.value }
}

const router = express.Router()

router.get('/goals', requireAuth, (req, res) => {
  res.json(goalsWithStatus(req.user))
})

router.post('/goals', requireAuth, (req, res) => {
  const fields = readGoalFields(req.body, null)
  if (fields.error) {
    return res.status(400).json({ error: fields.error })
  }
  if (countActiveGoals.get(req.user.id).count >= MAX_ACTIVE_GOALS) {
    return res.status(400).json({ error: `You can have up to ${MAX_ACTIVE_GOALS} active goals` })
  }

  const result = insertGoal.run(
    req.user.id,
    fields.title,
    fields.frequency,
    fields.timesPerWeek,
    fields.target,
    fields.unit,
    req.user.id
  )
  notifyActivity(req.user.id)
  res.status(201).json({ goal: singleGoalWithStatus(findGoal.get(result.lastInsertRowid), req.user) })
})

router.put('/goals/order', requireAuth, (req, res) => {
  const goalIds = readGoalIds(req.body.goalIds)
  if (goalIds.error) {
    return res.status(400).json({ error: goalIds.error })
  }
  const activeIds = findActiveGoals.all(req.user.id).map((goal) => goal.id)
  const sameGoals = goalIds.value.length === activeIds.length && activeIds.every((id) => goalIds.value.includes(id))
  if (!sameGoals) {
    return res.status(409).json({ error: 'Your goals changed. Refresh and try again.' })
  }
  saveOrder(goalIds.value)
  notifyActivity(req.user.id)
  res.json(goalsWithStatus(req.user))
})

router.patch('/goals/:id', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  const keys = ['title', 'frequency', 'timesPerWeek', 'target', 'unit']
  if (keys.every((key) => req.body[key] === undefined)) {
    return res.status(400).json({ error: 'Nothing to update' })
  }
  const fields = readGoalFields(req.body, goal)
  if (fields.error) {
    return res.status(400).json({ error: fields.error })
  }

  updateGoal.run(fields.title, fields.frequency, fields.timesPerWeek, fields.target, fields.unit, goal.id)
  const updated = findGoal.get(goal.id)
  const trackingChanged =
    fields.target !== goal.target || fields.frequency !== goal.frequency || fields.timesPerWeek !== goal.times_per_week
  if (updated.target !== null && trackingChanged) {
    const today = todayInTimezone(req.user.timezone)
    syncAmountCompletion(updated, req.user, addDays(today, -1))
    syncAmountCompletion(updated, req.user, today)
  }
  notifyActivity(req.user.id)
  res.json({ goal: singleGoalWithStatus(updated, req.user) })
})

router.post('/goals/:id/archive', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  archiveGoal.run(goal.id)
  notifyActivity(req.user.id)
  res.status(204).end()
})

router.get('/goals/archived', requireAuth, (req, res) => {
  res.json({
    goals: findArchivedGoals.all(req.user.id).map((goal) => ({
      id: goal.id,
      title: goal.title,
      frequency: goal.frequency,
      timesPerWeek: goal.times_per_week,
      target: goal.target,
      unit: goal.target === null ? null : goal.unit || '',
      archivedAt: goal.archived_at,
    })),
  })
})

router.post('/goals/:id/restore', requireAuth, (req, res) => {
  const id = readId(req.params.id, 'goal')
  if (id.error) {
    return res.status(400).json({ error: id.error })
  }
  const goal = findGoal.get(id.value)
  if (!goal) {
    return res.status(404).json({ error: 'Goal not found' })
  }
  if (goal.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only change your own goals' })
  }
  if (goal.is_active) {
    return res.status(409).json({ error: 'That goal is already on your list' })
  }
  if (countActiveGoals.get(req.user.id).count >= MAX_ACTIVE_GOALS) {
    return res.status(400).json({ error: `You can have up to ${MAX_ACTIVE_GOALS} active goals` })
  }
  restoreGoal.run(req.user.id, goal.id)
  notifyActivity(req.user.id)
  res.json({ goal: singleGoalWithStatus(findGoal.get(goal.id), req.user) })
})

router.post('/goals/:id/complete', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  if (goal.target !== null) {
    return res.status(400).json({ error: 'Log an amount for this goal instead' })
  }
  const date = readCompletionDate(req, res)
  if (!date) {
    return
  }
  const streakBefore = singleGoalWithStatus(goal, req.user).streak
  const result = insertCompletion.run(goal.id, req.user.id, date)
  let milestone = null
  if (result.changes === 1) {
    milestone = afterCompletionAdded(req.user, goal, date, streakBefore)
  }
  res.status(result.changes === 1 ? 201 : 200).json({ goal: singleGoalWithStatus(goal, req.user), milestone })
})

router.delete('/goals/:id/complete', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  if (goal.target !== null) {
    return res.status(400).json({ error: 'Log an amount for this goal instead' })
  }
  const date = readCompletionDate(req, res)
  if (!date) {
    return
  }
  const result = deleteCompletion.run(goal.id, date)
  if (result.changes === 1) {
    afterCompletionRemoved(req.user, goal)
  }
  res.json({ goal: singleGoalWithStatus(goal, req.user) })
})

router.put('/goals/:id/amount', requireAuth, (req, res) => {
  const goal = loadOwnActiveGoal(req, res)
  if (!goal) {
    return
  }
  if (goal.target === null) {
    return res.status(400).json({ error: 'This goal is checked off, not logged' })
  }
  const date = readCompletionDate(req, res)
  if (!date) {
    return
  }
  const amount = readAmount(req.body.amount)
  if (amount.error) {
    return res.status(400).json({ error: amount.error })
  }
  const streakBefore = singleGoalWithStatus(goal, req.user).streak
  if (amount.value === 0) {
    deleteAmount.run(goal.id, date)
  } else {
    saveAmount.run(goal.id, date, amount.value)
  }
  const change = syncAmountCompletion(goal, req.user, date)
  let milestone = null
  if (change === 'added') {
    milestone = afterCompletionAdded(req.user, goal, date, streakBefore)
  } else if (change === 'removed') {
    afterCompletionRemoved(req.user, goal)
  } else {
    notifyActivity(req.user.id)
  }
  res.json({ goal: singleGoalWithStatus(goal, req.user), milestone })
})

export default router
