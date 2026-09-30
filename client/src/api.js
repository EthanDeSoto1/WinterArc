const REQUEST_TIMEOUT_MS = 10000

function connectionError(message) {
  const error = new Error(message)
  error.status = 0
  return error
}

export async function api(path, options = {}) {
  if (navigator.onLine === false) {
    throw connectionError('You’re offline.')
  }

  let response
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (fetchError) {
    if (navigator.onLine === false) {
      throw connectionError('You’re offline.')
    }
    if (fetchError.name === 'TimeoutError') {
      throw connectionError('The server isn’t responding.')
    }
    throw connectionError('Couldn’t reach the server.')
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error((data && data.error) || 'Something went wrong. Please try again.')
    error.status = response.status
    if (response.status === 401 && path !== '/login') {
      window.dispatchEvent(new Event('winterarc:logged-out'))
    }
    throw error
  }

  return data
}
