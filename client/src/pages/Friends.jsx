import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import Page from '../components/Page.jsx'
import FriendCard from '../components/FriendCard.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx'

export default function Friends() {
  const [friends, setFriends] = useState([])
  const [incomingCount, setIncomingCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')

  function loadFriends() {
    setStatus('loading')
    Promise.all([api('/friends'), api('/friends/requests')])
      .then(([friendsResult, requestsResult]) => {
        setFriends(friendsResult.friends)
        setIncomingCount(requestsResult.incoming.length)
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

  const eyebrow = status === 'ready' ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}` : 'Your crew'

  return (
    <Page eyebrow={eyebrow} title="Friends">
      {status === 'loading' && <LoadingState message="Loading friends…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={loadFriends} />}
      {status === 'ready' && (
        <div className="flex flex-col gap-2.5">
          {incomingCount > 0 && (
            <Link
              to="/add-friend"
              className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-ice-300/25 bg-ice-300/[0.06] px-4 text-[15px] font-medium text-ice-100 transition active:bg-ice-300/10"
            >
              <span>
                {incomingCount} friend {incomingCount === 1 ? 'request' : 'requests'} waiting
              </span>
              <span className="text-sm font-semibold text-ice-300">View</span>
            </Link>
          )}

          {friends.length === 0 && (
            <EmptyState title="No friends yet" message="Add friends by username to follow each other’s Winter Arc.">
              <Link
                to="/add-friend"
                className="flex min-h-11 items-center rounded-xl bg-ice-50 px-5 text-sm font-semibold text-black shadow-[0_0_24px_-8px_rgb(174_219_255/0.6)]"
              >
                Add a friend
              </Link>
            </EmptyState>
          )}

          {friends.map((friend) => (
            <FriendCard key={friend.id} friend={friend} />
          ))}
        </div>
      )}
    </Page>
  )
}
