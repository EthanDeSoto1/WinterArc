import db from './db.js'
import { goalsWithStatus, isFinishedToday } from './goals.js'
import { sendToUser, markSentOnce, deleteOldSentNotifications } from './push.js'
import { seasonRange } from './dates.js'

const CHECK_EVERY_MS = 60 * 1000
const REMINDERS = [
  { column: 'remind_morning', kind: 'remind-morning', hour: 8, title: 'Morning check-in' },
  { column: 'remind_midday', kind: 'remind-midday', hour: 12, title: 'Midday check-in' },
  { column: 'remind_evening', kind: 'remind-evening', hour: 20, title: 'Evening check-in' },
]

const findUsersWithReminders = db.prepare(`
  SELECT * FROM users
  WHERE (remind_morning = 1 OR remind_midday = 1 OR remind_evening = 1)
    AND id IN (SELECT user_id FROM push_subscriptions)
`)

function hourInTimezone(timezone, now) {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(hour)
}

function goalsLeftText(goals) {
  const titles = goals.map((goal) => goal.title)
  const count = `${titles.length} ${titles.length === 1 ? 'goal' : 'goals'} left today`
  if (titles.length <= 2) {
    return `${count}: ${titles.join(' and ')}`
  }
  return `${count}: ${titles[0]}, ${titles[1]} and ${titles.length - 2} more`
}

export function sendDueReminders(now = new Date()) {
  for (const user of findUsersWithReminders.all()) {
    const hour = hourInTimezone(user.timezone, now)
    const reminder = REMINDERS.find((item) => item.hour === hour && user[item.column] === 1)
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
      deleteOldSentNotifications()
    } catch (error) {
      console.error('Reminder check failed', error)
    }
  }, CHECK_EVERY_MS).unref()
}
