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
