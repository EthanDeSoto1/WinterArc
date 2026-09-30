function dateFromString(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function daysUntilNewYear(todayString = localDateString(new Date())) {
  const today = dateFromString(todayString)
  const newYear = new Date(today.getFullYear() + 1, 0, 1)
  return Math.round((newYear - today) / 86400000)
}

export function formatDayLabel(dateString) {
  return dateFromString(dateString).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatMonthName(dateString) {
  return dateFromString(dateString).toLocaleDateString('en-US', { month: 'long' })
}

export function formatShortDate(dateString) {
  return dateFromString(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function dayOfMonth(dateString) {
  return Number(dateString.slice(8, 10))
}

export function isMonday(dateString) {
  return dateFromString(dateString).getDay() === 1
}

export function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function formatTime(timestamp, timezone) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })
}
