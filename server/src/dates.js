const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toUtcDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function fromUtcDate(date) {
  return date.toISOString().slice(0, 10)
}

export function todayInTimezone(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type) => parts.find((item) => item.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false
  }
  return fromUtcDate(toUtcDate(value)) === value
}

export function addDays(dateString, days) {
  const date = toUtcDate(dateString)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUtcDate(date)
}

export function weekStart(dateString) {
  const daysSinceMonday = (toUtcDate(dateString).getUTCDay() + 6) % 7
  return addDays(dateString, -daysSinceMonday)
}

export function isAllowedCompletionDate(dateString, timezone, now = new Date()) {
  if (!isValidDateString(dateString)) {
    return false
  }
  const today = todayInTimezone(timezone, now)
  return dateString === today || dateString === addDays(today, -1)
}

export function countInWeek(completedDates, anyDayInWeek) {
  const start = weekStart(anyDayInWeek)
  const end = addDays(start, 6)
  return completedDates.filter((date) => date >= start && date <= end).length
}

export function dailyStreak(completedDates, today) {
  const done = new Set(completedDates)
  let day = done.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (done.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

export function seasonRange(today) {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const seasonYear = month <= 6 ? year - 1 : year
  return { start: `${seasonYear}-10-01`, end: `${seasonYear}-12-31` }
}

function isLive(goal, firstDay, lastDay) {
  return goal.startDate <= firstDay && (goal.endDate === null || goal.endDate > lastDay)
}

function dayStatus(doneCount, total, isToday) {
  if (total === 0) {
    return null
  }
  if (doneCount === total) {
    return 'full'
  }
  if (isToday) {
    return 'today'
  }
  return doneCount * 2 >= total ? 'partial' : 'low'
}

function historyDay(goals, date, firstDay, lastDay, today) {
  const outside = date < firstDay || date > lastDay
  if (outside || date > today) {
    return { date, tracked: false, outside, status: null, done: [], missed: [], weeklyDone: [] }
  }
  const counted = goals.filter(
    (goal) => goal.frequency === 'daily' && (goal.dates.includes(date) || isLive(goal, date, date))
  )
  const done = counted.filter((goal) => goal.dates.includes(date)).map((goal) => goal.id)
  const missed = counted.filter((goal) => !goal.dates.includes(date)).map((goal) => goal.id)
  const weeklyDone = goals
    .filter((goal) => goal.frequency === 'weekly' && goal.dates.includes(date))
    .map((goal) => goal.id)
  return {
    date,
    tracked: true,
    outside: false,
    status: dayStatus(done.length, counted.length, date === today),
    done,
    missed,
    weeklyDone,
  }
}

function historyWeek(goals, monday, today) {
  if (monday > today) {
    return { status: null, goals: [] }
  }
  const sunday = addDays(monday, 6)
  const results = []
  for (const goal of goals) {
    if (goal.frequency !== 'weekly') {
      continue
    }
    const count = countInWeek(goal.dates, monday)
    const met = count >= goal.timesPerWeek
    if (met || isLive(goal, monday, sunday)) {
      results.push({ id: goal.id, count, target: goal.timesPerWeek, met })
    }
  }
  let status = null
  if (results.length > 0 && results.every((result) => result.met)) {
    status = 'met'
  } else if (results.length > 0) {
    status = monday === weekStart(today) ? 'inProgress' : 'missed'
  }
  return { status, goals: results }
}

export function buildHistory(goals, firstDay, lastDay, today) {
  const weeks = []
  for (let monday = weekStart(firstDay); monday <= lastDay; monday = addDays(monday, 7)) {
    const days = []
    for (let offset = 0; offset < 7; offset++) {
      days.push(historyDay(goals, addDays(monday, offset), firstDay, lastDay, today))
    }
    weeks.push({ start: monday, ...historyWeek(goals, monday, today), days })
  }
  return weeks
}

export function weeklyStreak(completedDates, timesPerWeek, today) {
  const countsByWeek = new Map()
  for (const date of completedDates) {
    const start = weekStart(date)
    countsByWeek.set(start, (countsByWeek.get(start) || 0) + 1)
  }
  const thisWeek = weekStart(today)
  const thisWeekDone = (countsByWeek.get(thisWeek) || 0) >= timesPerWeek
  let week = thisWeekDone ? thisWeek : addDays(thisWeek, -7)
  let streak = 0
  while ((countsByWeek.get(week) || 0) >= timesPerWeek) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}

export function finishedSeasonMonths(today) {
  const season = seasonRange(today)
  const year = season.start.slice(0, 4)
  return ['10', '11', '12']
    .map((month) => `${year}-${month}`)
    .filter((month) => month < addDays(today, -1).slice(0, 7))
    .reverse()
}

export function summarizeMonth(weeks, month) {
  const summary = { full: 0, partial: 0, low: 0 }
  let done = 0
  let total = 0
  for (const week of weeks) {
    for (const day of week.days) {
      if (day.date.slice(0, 7) !== month || !(day.status in summary)) {
        continue
      }
      summary[day.status]++
      done += day.done.length
      total += day.done.length + day.missed.length
    }
  }
  return { ...summary, percent: total === 0 ? null : Math.floor((done * 100) / total) }
}

export function summarizeWeek(weeks, monday) {
  const week = weeks.find((item) => item.start === monday)
  const summary = { percent: null, fullDays: 0, weeklyMet: 0, weeklyTotal: 0 }
  if (!week) {
    return summary
  }
  let done = 0
  let total = 0
  for (const day of week.days) {
    if (!day.tracked || day.status === null) {
      continue
    }
    done += day.done.length
    total += day.done.length + day.missed.length
    if (day.status === 'full') {
      summary.fullDays++
    }
  }
  summary.percent = total === 0 ? null : Math.floor((done * 100) / total)
  summary.weeklyMet = week.goals.filter((goal) => goal.met).length
  summary.weeklyTotal = week.goals.length
  return summary
}

export function longestDailyRun(dates, from, to) {
  const inRange = [...new Set(dates)].filter((date) => date >= from && date <= to).sort()
  let best = 0
  let run = 0
  let previous = null
  for (const date of inRange) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1
    best = Math.max(best, run)
    previous = date
  }
  return best
}
