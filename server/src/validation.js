const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function readUsername(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: 'Username is required' }
  }
  const username = value.trim().toLowerCase()
  if (!USERNAME_PATTERN.test(username)) {
    return { error: 'Username must be 3-20 characters using letters, numbers or _' }
  }
  return { value: username }
}

export function readDisplayName(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: 'Display name is required' }
  }
  const displayName = value.trim().replace(/\s+/g, ' ')
  if (displayName.length > 40) {
    return { error: 'Display name must be 40 characters or fewer' }
  }
  return { value: displayName }
}

export function readEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: 'Email is required' }
  }
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { error: 'Enter a valid email address' }
  }
  return { value: email }
}

export function readNewPassword(value) {
  if (typeof value !== 'string' || value === '') {
    return { error: 'Password is required' }
  }
  if (value.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    return { error: 'Password must be 72 characters or fewer' }
  }
  return { value }
}

export function readTimezone(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: 'Timezone is required' }
  }
  const timezone = value.trim()
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
  } catch {
    return { error: 'Timezone is not valid' }
  }
  return { value: timezone }
}

export function readGoalTitle(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: 'Goal title is required' }
  }
  const title = value.trim().replace(/\s+/g, ' ')
  if (title.length > 80) {
    return { error: 'Goal title must be 80 characters or fewer' }
  }
  return { value: title }
}

export function readFrequency(value) {
  if (value !== 'daily' && value !== 'weekly') {
    return { error: 'Frequency must be daily or weekly' }
  }
  return { value }
}

export function readTimesPerWeek(frequency, value) {
  if (frequency === 'daily') {
    if (value !== undefined && value !== null) {
      return { error: 'Daily goals do not have a times-per-week count' }
    }
    return { value: null }
  }
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    return { error: 'Times per week must be a whole number from 1 to 7' }
  }
  return { value }
}

export function readSearchQuery(value) {
  if (typeof value !== 'string') {
    return { value: '' }
  }
  const query = value.trim().toLowerCase().replace(/^@/, '')
  if (query.length > 20 || !/^[a-z0-9_]*$/.test(query)) {
    return { error: 'Usernames only use letters, numbers and _' }
  }
  return { value: query }
}

export function readId(value, name) {
  const id = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (!Number.isInteger(id) || id < 1) {
    return { error: `Invalid ${name} id` }
  }
  return { value: id }
}

export function readGoalIds(value) {
  if (!Array.isArray(value) || value.length > 100) {
    return { error: 'goalIds must be a list of goal ids' }
  }
  if (!value.every((id) => Number.isInteger(id) && id > 0)) {
    return { error: 'goalIds must be a list of goal ids' }
  }
  if (new Set(value).size !== value.length) {
    return { error: 'Each goal can only appear once' }
  }
  return { value }
}

export function firstError(fields) {
  const failed = fields.find((field) => field.error)
  return failed ? failed.error : null
}
