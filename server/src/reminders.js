import db from './db.js'
import { goalsWithStatus, isFinishedToday } from './goals.js'
import { sendToUser, markSentOnce, deleteOldSentNotifications, goalsLeftText } from './push.js'
import { seasonRange, todayInTimezone, weekStart, summarizeWeek } from './dates.js'
import { historyForUser } from './history.js'

const CHECK_EVERY_MS = 60 * 1000
const RECAP_HOUR = 19
const REMINDERS = [
  { column: 'remind_morning', kind: 'remind-morning', hourColumn: 'remind_morning_hour', title: 'Morning check-in' },
  { column: 'remind_midday', kind: 'remind-midday', hourColumn: 'remind_midday_hour', title: 'Midday check-in' },
  { column: 'remind_evening', kind: 'remind-evening', hourColumn: 'remind_evening_hour', title: 'Evening check-in' },
]

const findUsersWithReminders = db.prepare(`
  SELECT * FROM users
  WHERE (remind_morning = 1 OR remind_midday = 1 OR remind_evening = 1)
    AND id IN (SELECT user_id FROM push_subscriptions)
`)

const findUsersWantingRecap = db.prepare(`
  SELECT * FROM users
  WHERE notify_weekly_recap = 1 AND id IN (SELECT user_id FROM push_subscriptions)
`)
const findFriendsWithDetails = db.prepare(`
  SELECT users.* FROM friendships JOIN users ON users.id = friendships.addressee_id
  WHERE friendships.requester_id = ? AND friendships.status = 'accepted'
  UNION ALL
  SELECT users.* FROM friendships JOIN users ON users.id = friendships.requester_id
  WHERE friendships.addressee_id = ? AND friendships.status = 'accepted'
`)

function ordinal(number) {
  const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' }
  const lastTwo = number % 100
  return `${number}${lastTwo >= 11 && lastTwo <= 13 ? 'th' : suffixes[number % 10] || 'th'}`
}

export function weeklyRecapText(user) {
  const monday = weekStart(todayInTimezone(user.timezone))
  const mine = summarizeWeek(historyForUser(user).weeks, monday)
  if (mine.percent === null && mine.weeklyTotal === 0) {
    return null
  }
  const parts = []
  if (mine.percent !== null) {
    parts.push(`${mine.percent}% of daily goals`, `${mine.fullDays}/7 days all done`)
  }
  if (mine.weeklyTotal > 0) {
    parts.push(`weekly goals ${mine.weeklyMet}/${mine.weeklyTotal} met`)
  }
  const friends = findFriendsWithDetails.all(user.id, user.id)
  if (mine.percent !== null && friends.length > 0) {
    const percents = friends
      .map((friend) => summarizeWeek(historyForUser(friend).weeks, weekStart(todayInTimezone(friend.timezone))).percent)
      .filter((percent) => percent !== null)
    const rank = 1 + percents.filter((percent) => percent > mine.percent).length
    parts.push(`${ordinal(rank)} of ${percents.length + 1} with friends`)
  }
  return parts.join(' · ')
}

export function sendWeeklyRecaps(now = new Date()) {
  for (const user of findUsersWantingRecap.all()) {
    const today = todayInTimezone(user.timezone, now)
    const isSunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0
    const season = seasonRange(today)
    if (!isSunday || hourInTimezone(user.timezone, now) !== RECAP_HOUR || today < season.start || today > season.end) {
      continue
    }
    const body = weeklyRecapText(user)
    if (!body || !markSentOnce(user.id, 'weekly-recap', today)) {
      continue
    }
    sendToUser(user.id, { title: 'Your week in Winter Arc', body, url: '/history' }, 6 * 60 * 60)
  }
}

function hourInTimezone(timezone, now) {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(hour)
}

export function sendDueReminders(now = new Date()) {
  for (const user of findUsersWithReminders.all()) {
    const hour = hourInTimezone(user.timezone, now)
    const reminder = REMINDERS.find((item) => user[item.hourColumn] === hour && user[item.column] === 1)
    if (!reminder) {
      continue
    }
    const { today, goals } = goalsWithStatus(user)
    const season = seasonRange(today)
    if (today < season.start || today > season.end) {
      continue
    }
    const left = goals.filter((goal) => !isFinishedToday(goal))
    if (left.length === 0 || !markSentOnce(user.id, reminder.kind, today)) {
      continue
    }
    sendToUser(user.id, { title: reminder.title, body: goalsLeftText(left), url: '/' }, 60 * 60)
  }
}

export function startReminders() {
  setInterval(() => {
    try {
      sendDueReminders()
      sendWeeklyRecaps()
      deleteOldSentNotifications()
    } catch (error) {
      console.error('Reminder check failed', error)
    }
  }, CHECK_EVERY_MS).unref()
}
