import { useEffect, useState } from 'react'
import { api } from '../api.js'
import PersonRow, { SectionTitle } from './PersonRow.jsx'
import { SmallButton, TextField } from './Form.jsx'
import { ErrorState, LoadingState, Toast } from './States.jsx'

const SEARCH_PATTERN = /^@?[a-zA-Z0-9_]*$/

function SearchResultAction({ user, busy, onAdd, onAccept }) {
  if (user.friendship === 'friends') {
    return <span className="px-3 text-sm font-semibold text-ice-300">Friends</span>
  }
  if (user.friendship === 'outgoing') {
    return <span className="px-3 text-sm font-medium text-steel-400">Requested</span>
  }
  if (user.friendship === 'incoming') {
    return (
      <SmallButton primary disabled={busy} onClick={onAccept}>
        Accept
      </SmallButton>
    )
  }
  return (
    <SmallButton primary disabled={busy} onClick={onAdd}>
      Add
    </SmallButton>
  )
}

export default function AddFriendPanel({ onFriendsChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle')
  const [searchError, setSearchError] = useState('')
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] })
  const [requestsStatus, setRequestsStatus] = useState('loading')
  const [requestsError, setRequestsError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [toast, setToast] = useState('')

  const trimmedQuery = query.trim()
  const queryIsValid = SEARCH_PATTERN.test(trimmedQuery)

  function loadRequests() {
    api('/friends/requests')
      .then((result) => {
        setRequests(result)
        setRequestsStatus('ready')
      })
      .catch((error) => {
        setRequestsError(error.message)
        setRequestsStatus('error')
      })
  }

  useEffect(() => {
    loadRequests()
  }, [])

  useEffect(() => {
    if (trimmedQuery === '' || trimmedQuery === '@' || !queryIsValid) {
      setResults([])
      setSearchStatus('idle')
      return
    }
    setSearchStatus('loading')
    let cancelled = false
    const timer = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(trimmedQuery)}`)
        .then((result) => {
          if (!cancelled) {
            setResults(result.users)
            setSearchStatus('ready')
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setSearchError(error.message)
            setSearchStatus('error')
          }
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmedQuery, queryIsValid, searchAttempt])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  function setResultState(userId, friendship, requestId) {
    setResults((current) => current.map((user) => (user.id === userId ? { ...user, friendship, requestId } : user)))
  }

  async function runAction(key, action) {
    setBusyKey(key)
    try {
      await action()
    } catch (error) {
      setToast(error.message)
    }
    setBusyKey(null)
    loadRequests()
    onFriendsChange()
  }

  function sendRequest(user) {
    runAction(`user-${user.id}`, async () => {
      const result = await api('/friends/requests', { method: 'POST', body: { userId: user.id } })
      setResultState(user.id, result.user.friendship, result.user.requestId)
    })
  }

  function acceptRequest(requestId, userId) {
    runAction(`request-${requestId}`, async () => {
      await api(`/friends/requests/${requestId}/accept`, { method: 'POST' })
      setResultState(userId, 'friends', null)
    })
  }

  function declineRequest(requestId, userId) {
    runAction(`request-${requestId}`, async () => {
      await api(`/friends/requests/${requestId}/decline`, { method: 'POST' })
      setResultState(userId, 'none', null)
    })
  }

  function cancelRequest(requestId, userId) {
    runAction(`request-${requestId}`, async () => {
      await api(`/friends/requests/${requestId}`, { method: 'DELETE' })
      setResultState(userId, 'none', null)
    })
  }

  return (
    <section className="mb-8 border-b border-white/[0.06] pb-8 lg:max-w-2xl" aria-label="Add friend">
      <form onSubmit={(event) => event.preventDefault()} role="search">
        <TextField
          label="Search by username"
          id="friendSearch"
          type="search"
          placeholder="e.g. jake"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={21}
        />
      </form>

      <div className="mt-3 flex flex-col gap-2.5" aria-live="polite">
        {!queryIsValid && <p className="px-1 text-sm text-rose-200">Usernames only use letters, numbers and _</p>}
        {searchStatus === 'loading' && (
          <p className="px-1 py-3 text-sm text-steel-500" role="status">
            Searching…
          </p>
        )}
        {searchStatus === 'error' && <ErrorState message={searchError} onRetry={() => setSearchAttempt(searchAttempt + 1)} />}
        {searchStatus === 'ready' && results.length === 0 && (
          <p className="px-1 py-3 text-sm text-steel-400">No one’s username starts with “{trimmedQuery.replace(/^@/, '')}”.</p>
        )}
        {searchStatus === 'ready' &&
          results.map((user) => (
            <PersonRow key={user.id} user={user}>
              <SearchResultAction
                user={user}
                busy={busyKey !== null}
                onAdd={() => sendRequest(user)}
                onAccept={() => acceptRequest(user.requestId, user.id)}
              />
            </PersonRow>
          ))}
      </div>

      <section className="mt-8">
        <SectionTitle>Requests</SectionTitle>
        {requestsStatus === 'loading' && <LoadingState message="Loading requests…" />}
        {requestsStatus === 'error' && (
          <ErrorState
            message={requestsError}
            onRetry={() => {
              setRequestsStatus('loading')
              loadRequests()
            }}
          />
        )}
        {requestsStatus === 'ready' && requests.incoming.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-steel-400">
            No friend requests right now.
          </p>
        )}
        {requestsStatus === 'ready' && (
          <div className="flex flex-col gap-2.5">
            {requests.incoming.map((request) => (
              <PersonRow key={request.id} user={request.user}>
                <SmallButton
                  disabled={busyKey !== null}
                  onClick={() => declineRequest(request.id, request.user.id)}
                  aria-label={`Decline ${request.user.displayName}`}
                >
                  Decline
                </SmallButton>
                <SmallButton
                  primary
                  disabled={busyKey !== null}
                  onClick={() => acceptRequest(request.id, request.user.id)}
                  aria-label={`Accept ${request.user.displayName}`}
                >
                  Accept
                </SmallButton>
              </PersonRow>
            ))}
          </div>
        )}
      </section>

      {requestsStatus === 'ready' && requests.outgoing.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Sent · waiting</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {requests.outgoing.map((request) => (
              <PersonRow key={request.id} user={request.user}>
                <SmallButton
                  disabled={busyKey !== null}
                  onClick={() => cancelRequest(request.id, request.user.id)}
                  aria-label={`Cancel request to ${request.user.displayName}`}
                >
                  Cancel
                </SmallButton>
              </PersonRow>
            ))}
          </div>
        </section>
      )}
      <Toast message={toast} />
    </section>
  )
}
