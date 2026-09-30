import { useEffect, useState } from 'react'
import { api } from '../api.js'
import PersonRow, { SectionTitle } from './PersonRow.jsx'
import { FormError, SmallButton } from './Form.jsx'
import { ErrorState } from './States.jsx'

export default function ManageFriends() {
  const [friends, setFriends] = useState([])
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [removeError, setRemoveError] = useState('')
  const [busyId, setBusyId] = useState(null)

  function loadFriends() {
    setStatus('loading')
    api('/friends')
      .then((result) => {
        setFriends(result.friends)
        setStatus('ready')
      })
      .catch((error) => {
        setLoadError(error.message)
        setStatus('error')
      })
  }

  useEffect(() => {
    loadFriends()
  }, [])

  async function removeFriend(friend) {
    const confirmed = window.confirm(`Remove ${friend.displayName} as a friend? You can add each other again later.`)
    if (!confirmed) {
      return
    }
    setRemoveError('')
    setBusyId(friend.id)
    try {
      await api(`/friends/${friend.id}`, { method: 'DELETE' })
      setFriends(friends.filter((item) => item.id !== friend.id))
    } catch (error) {
      setRemoveError(error.message)
    }
    setBusyId(null)
  }

  return (
    <section className="mt-8">
      <SectionTitle>Manage friends</SectionTitle>
      {status === 'loading' && (
        <div className="flex items-center gap-3 px-1 py-4 text-sm text-steel-500" role="status">
          <div className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-ice-300" />
          Loading friends…
        </div>
      )}
      {status === 'error' && <ErrorState message={loadError} onRetry={loadFriends} />}
      {status === 'ready' && friends.length === 0 && <p className="px-1 text-sm text-steel-500">You don’t have any friends added yet.</p>}
      {status === 'ready' && friends.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <FormError message={removeError} />
          {friends.map((friend) => (
            <PersonRow key={friend.id} user={friend}>
              <SmallButton
                disabled={busyId !== null}
                onClick={() => removeFriend(friend)}
                aria-label={`Remove ${friend.displayName} as a friend`}
                className="active:text-rose-300"
              >
                {busyId === friend.id ? 'Removing…' : 'Remove'}
              </SmallButton>
            </PersonRow>
          ))}
        </div>
      )}
    </section>
  )
}
