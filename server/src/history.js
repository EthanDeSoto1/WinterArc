import express from 'express'
import db from './db.js'
import { requireAuth, wrappedAvailable } from './auth.js'
import { publicUser } from './friends.js'
import {
  todayInTimezone,
  seasonRange,
  buildHistory,
  finishedSeasonMonths,
  summarizeMonth,
  longestDailyRun,
} from './dates.js'

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

export function historyForUser(user) {
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

const countSeasonPosts = db.prepare('SELECT count(*) AS count FROM posts WHERE user_id = ? AND created_at BETWEEN ? AND ?')
const countReactionsReceived = db.prepare(`
  SELECT count(*) AS count FROM post_reactions JOIN posts ON posts.id = post_reactions.post_id
  WHERE posts.user_id = ? AND post_reactions.user_id <> ?
`)
const countCheersReceived = db.prepare(`
  SELECT count(*) AS count FROM cheers JOIN completions ON completions.id = cheers.completion_id
  WHERE completions.user_id = ?
`)
const countMilestones = db.prepare('SELECT count(*) AS count FROM milestones WHERE user_id = ? AND reached_on BETWEEN ? AND ?')

function summarizeSeason(weeks, season) {
  let done = 0
  let total = 0
  let fullDays = 0
  for (const week of weeks) {
    for (const day of week.days) {
      if (day.date < season.start || day.date > season.end || !['full', 'partial', 'low'].includes(day.status)) {
        continue
      }
      done += day.done.length
      total += day.done.length + day.missed.length
      if (day.status === 'full') {
        fullDays++
      }
    }
  }
  return { percent: total === 0 ? null : Math.floor((done * 100) / total), fullDays }
}

function seasonWrapped(viewer) {
  const today = todayInTimezone(viewer.timezone)
  const season = seasonRange(today)
  const history = historyForUser(viewer)
  const completions = findCompletions.all(viewer.id).filter((row) => row.completed_on >= season.start && row.completed_on <= season.end)
  const goals = findAllGoals.all(viewer.id)

  let bestStreak = { days: 0, goal: null }
  for (const goal of goals.filter((item) => item.frequency === 'daily')) {
    const dates = completions.filter((row) => row.goal_id === goal.id).map((row) => row.completed_on)
    const days = longestDailyRun(dates, season.start, season.end)
    if (days > bestStreak.days) {
      bestStreak = { days, goal: goal.title }
    }
  }

  const months = ['10', '11', '12'].map((month) => {
    const key = `${season.start.slice(0, 4)}-${month}`
    return { month: key, percent: summarizeMonth(history.weeks, key).percent }
  })
  const bestMonth = months
    .filter((item) => item.percent !== null)
    .reduce((best, item) => (best === null || item.percent > best.percent ? item : best), null)

  const mine = summarizeSeason(history.weeks, season)
  const friends = findFriendsWithDetails.all(viewer.id, viewer.id)
  let rank = null
  if (mine.percent !== null && friends.length > 0) {
    const percents = friends
      .map((friend) => summarizeSeason(historyForUser(friend).weeks, season).percent)
      .filter((percent) => percent !== null)
    rank = { place: 1 + percents.filter((percent) => percent > mine.percent).length, of: percents.length + 1 }
  }

  const from = `${season.start}T00:00:00.000Z`
  const to = `${season.end}T23:59:59.999Z`
  return {
    season,
    checkoffs: completions.length,
    percent: mine.percent,
    fullDays: mine.fullDays,
    bestStreak,
    bestMonth,
    rank,
    posts: countSeasonPosts.get(viewer.id, from, to).count,
    reactions: countReactionsReceived.get(viewer.id, viewer.id).count,
    cheers: countCheersReceived.get(viewer.id).count,
    milestones: countMilestones.get(viewer.id, season.start, season.end).count,
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

router.get('/wrapped', requireAuth, (req, res) => {
  if (!wrappedAvailable(req.user)) {
    return res.status(404).json({ error: 'Your wrap-up opens on January 1' })
  }
  res.json(seasonWrapped(req.user))
})

router.get('/history/friends', requireAuth, (req, res) => {
  res.json(friendsMonthly(req.user))
})

export default router
