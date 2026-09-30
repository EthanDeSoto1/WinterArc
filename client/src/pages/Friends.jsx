import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api.js'
import Page from '../components/Page.jsx'
import AddFriendPanel from '../components/AddFriendPanel.jsx'
import { AddFriendIcon } from '../components/Icons.jsx'
import FriendCard from '../components/FriendCard.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import { SectionTitle } from '../components/PersonRow.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx'

export default function Friends() {
  const [friends, setFriends] = useState([])
  const [incomingCount, setIncomingCount] = useState(0)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const adding = searchParams.get('add') === '1'

  function loadFriends(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    Promise.all([api('/friends'), api('/friends/requests')])
      .then(([friendsResult, requestsResult]) => {
        setFriends(friendsResult.friends)
        setIncomingCount(requestsResult.incoming.length)
        setStatus('ready')
      })
      .catch((error) => {
        if (showSpinner) {
          setLoadError(error.message)
          setStatus('error')
        }
      })
  }

  useEffect(() => {
    loadFriends(true)
    function handleActivity() {
      loadFriends(false)
    }
    window.addEventListener('winterarc:activity', handleActivity)
    return () => window.removeEventListener('winterarc:activity', handleActivity)
  }, [])

  const eyebrow = status === 'ready' ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}` : 'Your crew'

  function toggleAdding() {
    setSearchParams(adding ? {} : { add: '1' }, { replace: true })
  }

  const addButton = (
    <button
      type="button"
      onClick={toggleAdding}
      aria-expanded={adding}
      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.97] ${
        adding
          ? 'border border-white/10 text-steel-200 active:bg-white/5'
          : 'bg-ice-50 text-black shadow-[0_0_20px_-8px_rgb(174_219_255/0.6)] active:bg-ice-200'
      }`}
    >
      {adding ? (
        'Done'
      ) : (
        <>
          <AddFriendIcon className="size-5" />
          Add friend
        </>
      )}
    </button>
  )

  return (
    <Page eyebrow={eyebrow} title="Friends" action={addButton} wide>
      {adding && <AddFriendPanel onFriendsChange={() => loadFriends(false)} />}
      {status === 'loading' && <LoadingState message="Loading friends…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={() => loadFriends(true)} />}
      {status === 'ready' && (
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
          <div>
            <div className="hidden lg:block">
              <SectionTitle>Crew</SectionTitle>
            </div>
            <div className="stagger flex flex-col gap-2.5">
              {incomingCount > 0 && !adding && (
                <Link
                  to="/friends?add=1"
                  replace
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
                    to="/friends?add=1"
                    replace
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
          </div>
          <ActivityFeed />
        </div>
      )}
    </Page>
  )
}
