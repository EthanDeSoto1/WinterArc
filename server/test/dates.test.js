import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  todayInTimezone,
  isValidDateString,
  addDays,
  weekStart,
  isAllowedCompletionDate,
  countInWeek,
  dailyStreak,
  weeklyStreak,
  seasonRange,
  buildHistory,
  finishedSeasonMonths,
  summarizeMonth,
  summarizeWeek,
  longestDailyRun,
} from '../src/dates.js'

test('today flips at local midnight, not UTC midnight', () => {
  assert.equal(todayInTimezone('America/Chicago', new Date('2026-10-01T04:59:59Z')), '2026-09-30')
  assert.equal(todayInTimezone('America/Chicago', new Date('2026-10-01T05:00:00Z')), '2026-10-01')
  assert.equal(todayInTimezone('UTC', new Date('2026-10-01T00:00:00Z')), '2026-10-01')
  assert.equal(todayInTimezone('UTC', new Date('2026-09-30T23:59:59Z')), '2026-09-30')
})

test('timezones ahead of UTC are already on the next day', () => {
  assert.equal(todayInTimezone('Asia/Tokyo', new Date('2026-09-30T15:00:00Z')), '2026-10-01')
  assert.equal(todayInTimezone('Pacific/Kiritimati', new Date('2026-09-30T10:00:00Z')), '2026-10-01')
  assert.equal(todayInTimezone('Asia/Kolkata', new Date('2026-09-30T18:29:00Z')), '2026-09-30')
  assert.equal(todayInTimezone('Asia/Kolkata', new Date('2026-09-30T18:30:00Z')), '2026-10-01')
})

test('daylight saving change keeps midnight correct', () => {
  assert.equal(todayInTimezone('America/Chicago', new Date('2026-11-01T04:59:00Z')), '2026-10-31')
  assert.equal(todayInTimezone('America/Chicago', new Date('2026-11-01T05:00:00Z')), '2026-11-01')
  assert.equal(todayInTimezone('America/Chicago', new Date('2026-11-02T05:59:00Z')), '2026-11-01')
  assert.equal(todayInTimezone('America/Chicago', new Date('2026-11-02T06:00:00Z')), '2026-11-02')
})

test('date strings are validated', () => {
  assert.equal(isValidDateString('2026-10-01'), true)
  assert.equal(isValidDateString('2028-02-29'), true)
  assert.equal(isValidDateString('2026-02-29'), false)
  assert.equal(isValidDateString('2026-02-30'), false)
  assert.equal(isValidDateString('2026-13-01'), false)
  assert.equal(isValidDateString('2026-1-01'), false)
  assert.equal(isValidDateString('10/01/2026'), false)
  assert.equal(isValidDateString(20261001), false)
  assert.equal(isValidDateString(undefined), false)
})

test('adding days crosses months, years and leap days', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2027-01-01', -1), '2026-12-31')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2026-11-01', 1), '2026-11-02')
})

test('weeks run Monday to Sunday', () => {
  assert.equal(weekStart('2026-09-28'), '2026-09-28')
  assert.equal(weekStart('2026-10-04'), '2026-09-28')
  assert.equal(weekStart('2026-10-05'), '2026-10-05')
  assert.equal(weekStart('2026-12-31'), '2026-12-28')
  assert.equal(weekStart('2027-01-03'), '2026-12-28')
  assert.equal(weekStart('2027-01-04'), '2027-01-04')
})

test('check-offs are only allowed for today and yesterday in the user timezone', () => {
  const now = new Date('2026-10-01T03:00:00Z')
  assert.equal(isAllowedCompletionDate('2026-09-30', 'America/Chicago', now), true)
  assert.equal(isAllowedCompletionDate('2026-09-29', 'America/Chicago', now), true)
  assert.equal(isAllowedCompletionDate('2026-09-28', 'America/Chicago', now), false)
  assert.equal(isAllowedCompletionDate('2026-10-01', 'America/Chicago', now), false)
  assert.equal(isAllowedCompletionDate('2026-10-01', 'Europe/London', now), true)
  assert.equal(isAllowedCompletionDate('not-a-date', 'America/Chicago', now), false)
})

test('weekly count only includes the current Monday-Sunday week', () => {
  const dates = ['2026-09-27', '2026-09-28', '2026-10-01', '2026-10-04', '2026-10-05']
  assert.equal(countInWeek(dates, '2026-10-01'), 3)
  assert.equal(countInWeek(dates, '2026-10-05'), 1)
  assert.equal(countInWeek([], '2026-10-01'), 0)
})

test('daily streak counts back from today, or from yesterday if today is not done yet', () => {
  assert.equal(dailyStreak(['2026-10-03', '2026-10-04', '2026-10-05'], '2026-10-05'), 3)
  assert.equal(dailyStreak(['2026-10-03', '2026-10-04'], '2026-10-05'), 2)
  assert.equal(dailyStreak(['2026-10-02', '2026-10-03'], '2026-10-05'), 0)
  assert.equal(dailyStreak(['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-05'], '2026-10-05'), 3)
  assert.equal(dailyStreak(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01'), 3)
  assert.equal(dailyStreak([], '2026-10-05'), 0)
})

test('weekly streak counts weeks that hit the target, and an unfinished current week does not break it', () => {
  const lastTwoWeeksHit = ['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-11']
  assert.equal(weeklyStreak(lastTwoWeeksHit, 3, '2026-10-13'), 2)
  assert.equal(weeklyStreak([...lastTwoWeeksHit, '2026-10-12'], 3, '2026-10-13'), 2)
  assert.equal(weeklyStreak([...lastTwoWeeksHit, '2026-10-12', '2026-10-13', '2026-10-14'], 3, '2026-10-14'), 3)
  assert.equal(weeklyStreak(['2026-09-28', '2026-10-05', '2026-10-06'], 2, '2026-10-20'), 0)
  assert.equal(weeklyStreak(['2026-12-28', '2027-01-03'], 2, '2027-01-03'), 1)
  assert.equal(weeklyStreak(['2026-10-04', '2026-10-05'], 2, '2026-10-06'), 0)
})

test('the season is Oct 1 to Dec 31, and January still shows the season that just ended', () => {
  assert.deepEqual(seasonRange('2026-09-30'), { start: '2026-10-01', end: '2026-12-31' })
  assert.deepEqual(seasonRange('2026-11-15'), { start: '2026-10-01', end: '2026-12-31' })
  assert.deepEqual(seasonRange('2027-01-01'), { start: '2026-10-01', end: '2026-12-31' })
})

function daily(id, startDate, dates, endDate = null) {
  return { id, frequency: 'daily', timesPerWeek: null, startDate, endDate, dates }
}

function weekly(id, timesPerWeek, startDate, dates, endDate = null) {
  return { id, frequency: 'weekly', timesPerWeek, startDate, endDate, dates }
}

function findDay(weeks, date) {
  return weeks.flatMap((week) => week.days).find((day) => day.date === date)
}

test('history grades days green, yellow and red by the share of daily goals done', () => {
  const goals = [
    daily(1, '2026-10-01', ['2026-10-01', '2026-10-02', '2026-10-03']),
    daily(2, '2026-10-01', ['2026-10-01', '2026-10-02']),
    daily(3, '2026-10-01', ['2026-10-01']),
    daily(4, '2026-10-01', ['2026-10-01']),
  ]
  const weeks = buildHistory(goals, '2026-10-01', '2026-12-31', '2026-10-05')
  assert.equal(weeks[0].start, '2026-09-28')
  assert.equal(weeks.at(-1).start, '2026-12-28')
  assert.equal(findDay(weeks, '2026-10-01').status, 'full')
  assert.equal(findDay(weeks, '2026-10-02').status, 'partial')
  assert.equal(findDay(weeks, '2026-10-03').status, 'low')
  assert.equal(findDay(weeks, '2026-10-04').status, 'low')
  assert.deepEqual(findDay(weeks, '2026-10-02').missed, [3, 4])
})

test('today is not graded until everything is done, and future or out-of-range days are not tracked', () => {
  const goals = [daily(1, '2026-10-01', ['2026-10-05']), daily(2, '2026-10-01', [])]
  let weeks = buildHistory(goals, '2026-10-01', '2026-12-31', '2026-10-05')
  assert.equal(findDay(weeks, '2026-10-05').status, 'today')
  assert.equal(findDay(weeks, '2026-10-06').tracked, false)
  assert.equal(findDay(weeks, '2026-09-30').outside, true)
  weeks = buildHistory([daily(1, '2026-10-01', ['2026-10-05'])], '2026-10-01', '2026-12-31', '2026-10-05')
  assert.equal(findDay(weeks, '2026-10-05').status, 'full')
})

test('daily goals only count on days they existed, unless checked off that day', () => {
  const goals = [
    daily(1, '2026-10-01', ['2026-10-01', '2026-10-02', '2026-10-03']),
    daily(2, '2026-10-03', ['2026-10-02']),
    daily(3, '2026-10-01', ['2026-10-01'], '2026-10-02'),
  ]
  const weeks = buildHistory(goals, '2026-10-01', '2026-12-31', '2026-10-05')
  assert.deepEqual(findDay(weeks, '2026-10-01').missed, [])
  assert.deepEqual(findDay(weeks, '2026-10-02').done, [1, 2])
  assert.deepEqual(findDay(weeks, '2026-10-03').missed, [2])
  assert.equal(findDay(weeks, '2026-10-02').status, 'full')
})

test('a day with no daily goals has no grade but still lists weekly check-offs', () => {
  const weeks = buildHistory([weekly(9, 2, '2026-10-01', ['2026-10-06'])], '2026-10-01', '2026-12-31', '2026-10-07')
  const day = findDay(weeks, '2026-10-06')
  assert.equal(day.status, null)
  assert.deepEqual(day.weeklyDone, [9])
})

test('weeks are met, missed or in progress, and a new goal is not held against its first partial week', () => {
  const goals = [
    weekly(1, 2, '2026-09-28', ['2026-09-29', '2026-10-01', '2026-10-06', '2026-10-13', '2026-10-14']),
    weekly(2, 1, '2026-10-07', ['2026-10-14']),
  ]
  const weeks = buildHistory(goals, '2026-10-01', '2026-12-31', '2026-10-21')
  const byStart = (start) => weeks.find((week) => week.start === start)
  assert.equal(byStart('2026-09-28').status, 'met')
  assert.equal(byStart('2026-10-05').status, 'missed')
  assert.deepEqual(byStart('2026-10-05').goals, [{ id: 1, count: 1, target: 2, met: false }])
  assert.equal(byStart('2026-10-12').status, 'met')
  assert.equal(byStart('2026-10-19').status, 'inProgress')
  assert.equal(byStart('2026-10-26').status, null)
})

test('a season month counts as finished from the 2nd of the next month, once yesterday can no longer change it', () => {
  assert.deepEqual(finishedSeasonMonths('2026-09-30'), [])
  assert.deepEqual(finishedSeasonMonths('2026-10-31'), [])
  assert.deepEqual(finishedSeasonMonths('2026-11-01'), [])
  assert.deepEqual(finishedSeasonMonths('2026-11-02'), ['2026-10'])
  assert.deepEqual(finishedSeasonMonths('2026-12-15'), ['2026-11', '2026-10'])
  assert.deepEqual(finishedSeasonMonths('2027-01-01'), ['2026-11', '2026-10'])
  assert.deepEqual(finishedSeasonMonths('2027-01-02'), ['2026-12', '2026-11', '2026-10'])
  assert.deepEqual(finishedSeasonMonths('2027-03-10'), ['2026-12', '2026-11', '2026-10'])
})

test('month summary counts graded days and the share of daily check-offs', () => {
  const goals = [
    { id: 1, frequency: 'daily', timesPerWeek: null, startDate: '2026-09-20', endDate: null, dates: ['2026-10-30', '2026-10-31', '2026-11-01'] },
    { id: 2, frequency: 'daily', timesPerWeek: null, startDate: '2026-09-20', endDate: null, dates: ['2026-10-31'] },
    { id: 3, frequency: 'weekly', timesPerWeek: 2, startDate: '2026-09-20', endDate: null, dates: ['2026-10-29'] },
  ]
  const weeks = buildHistory(goals, '2026-10-01', '2026-12-31', '2026-11-02')
  const october = summarizeMonth(weeks, '2026-10')
  assert.equal(october.full, 1)
  assert.equal(october.partial, 1)
  assert.equal(october.low, 29)
  assert.equal(october.percent, Math.floor((3 * 100) / 62))
  const november = summarizeMonth(weeks, '2026-11')
  assert.deepEqual(november, { full: 0, partial: 1, low: 0, percent: 50 })
})

test('month summary has no percent when there were no daily goals', () => {
  const goals = [{ id: 1, frequency: 'weekly', timesPerWeek: 3, startDate: '2026-09-20', endDate: null, dates: ['2026-10-05'] }]
  const weeks = buildHistory(goals, '2026-10-01', '2026-12-31', '2026-11-10')
  assert.deepEqual(summarizeMonth(weeks, '2026-10'), { full: 0, partial: 0, low: 0, percent: null })
})

test('week summary counts this week so far, full days and weekly goals', () => {
  const goals = [
    { id: 1, frequency: 'daily', timesPerWeek: null, startDate: '2026-09-20', endDate: null, dates: ['2026-10-05', '2026-10-06', '2026-10-07'] },
    { id: 2, frequency: 'daily', timesPerWeek: null, startDate: '2026-09-20', endDate: null, dates: ['2026-10-05'] },
    { id: 3, frequency: 'weekly', timesPerWeek: 2, startDate: '2026-09-20', endDate: null, dates: ['2026-10-06', '2026-10-08'] },
  ]
  const weeks = buildHistory(goals, '2026-10-01', '2026-12-31', '2026-10-08')
  const week = summarizeWeek(weeks, '2026-10-05')
  assert.equal(week.fullDays, 1)
  assert.equal(week.percent, 50)
  assert.equal(week.weeklyMet, 1)
  assert.equal(week.weeklyTotal, 1)
  assert.deepEqual(summarizeWeek(weeks, '2027-01-04'), { percent: null, fullDays: 0, weeklyMet: 0, weeklyTotal: 0 })
})

test('longest daily run only counts days inside the range', () => {
  const dates = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']
  assert.equal(longestDailyRun(dates, '2026-10-01', '2026-12-31'), 4)
  assert.equal(longestDailyRun([], '2026-10-01', '2026-12-31'), 0)
  assert.equal(longestDailyRun(['2026-12-31', '2027-01-01'], '2026-10-01', '2026-12-31'), 1)
})
