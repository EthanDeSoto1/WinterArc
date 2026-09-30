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
