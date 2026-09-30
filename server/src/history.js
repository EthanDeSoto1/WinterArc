import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { publicUser } from './friends.js'
import { todayInTimezone, seasonRange, buildHistory, finishedSeasonMonths, summarizeMonth } from './dates.js'

const findAllGoals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY position, id')
const findCompletions = db.prepare(`
  SELECT completions.goal_id, completions.completed_on
  FROM completions
  JOIN goals ON goals.id = completions.goal_id
  WHERE goals.user_id = ?
  ORDER BY completions.completed_on
`)
const findFriendsWithDetails = db.prepare(`
  SELECT users.* FROM friendships JOIN users ON users.id = friendships.addressee_id
  WHERE friendships.requester_id = ? AND friendships.status = 'accepted'
  UNION ALL
  SELECT users.* FROM friendships JOIN users ON users.id = friendships.requester_id
  WHERE friendships.addressee_id = ? AND friendships.status = 'accepted'
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

function comparePeople(a, b) {
  if (a.percent !== b.percent) {
    if (a.percent === null) {
      return 1
    }
    if (b.percent === null) {
      return -1
    }
    return b.percent - a.percent
  }
  if (a.full !== b.full) {
    return b.full - a.full
  }
  return a.user.displayName.localeCompare(b.user.displayName)
}

function friendsMonthly(viewer) {
  const months = finishedSeasonMonths(todayInTimezone(viewer.timezone))
  const people = [viewer, ...findFriendsWithDetails.all(viewer.id, viewer.id)]
  const histories = people.map((person) => ({ person, weeks: historyForUser(person).weeks }))
  return {
    months: months.map((month) => ({
      month,
      people: histories
        .map(({ person, weeks }) => ({
          user: publicUser(person),
          isYou: person.id === viewer.id,
          ...summarizeMonth(weeks, month),
        }))
        .sort(comparePeople),
    })),
  }
}

const router = express.Router()

router.get('/history', requireAuth, (req, res) => {
  res.json(historyForUser(req.user))
})

router.get('/history/friends', requireAuth, (req, res) => {
  res.json(friendsMonthly(req.user))
})

export default router
