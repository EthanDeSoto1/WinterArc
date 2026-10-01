import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import { Avatar, SectionTitle } from './PersonRow.jsx'
import { FlameIcon } from './Icons.jsx'
import { MilestoneBadge } from './Milestone.jsx'
import { ErrorState, Toast } from './States.jsx'
import { formatDayLabel, formatTime } from '../dates.js'

function dayHeading(day, feed) {
  if (day === feed.today) {
    return 'Today'
  }
  if (day === feed.yesterday) {
    return 'Yesterday'
  }
  return formatDayLabel(day)
}

function groupByDay(items) {
  const groups = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.day === item.day) {
      last.items.push(item)
    } else {
      groups.push({ day: item.day, items: [item] })
    }
  }
  return groups
}

const MAX_FACES = 3

function cheerNames(item, viewerId) {
  return item.cheers.map((person) => (person.id === viewerId ? 'you' : person.displayName)).join(', ')
}

function CheerFaces({ people }) {
  if (people.length === 0) {
    return null
  }
  return (
    <>
      <span className="flex items-center -space-x-1.5" aria-hidden="true">
        {people.slice(0, MAX_FACES).map((person) => (
          <Avatar key={person.id} user={person} small className="ring-2 ring-ink-900" />
        ))}
      </span>
      {people.length > MAX_FACES && (
        <span aria-hidden="true" className="text-xs">
          +{people.length - MAX_FACES}
        </span>
      )}
    </>
  )
}

function Cheers({ item, viewerId, onCheer }) {
  const names = cheerNames(item, viewerId)
  if (!item.canCheer) {
    if (item.cheers.length === 0) {
      return null
    }
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-steel-400" aria-label={`Cheered by ${names}`} title={`Cheered by ${names}`}>
        <FlameIcon className="size-3.5 text-ice-300" strokeWidth={2} aria-hidden="true" />
        <CheerFaces people={item.cheers} />
        <span aria-hidden="true">cheered</span>
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onCheer(item)}
      aria-pressed={item.cheeredByMe}
      aria-label={item.cheers.length > 0 ? `Cheer, ${item.cheers.length}: ${names}` : 'Cheer'}
      title={item.cheers.length > 0 ? `Cheered by ${names}` : 'Cheer'}
      className="group -mb-2 -ml-1.5 flex min-h-11 items-center"
    >
      <span
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition group-active:scale-95 ${
          item.cheeredByMe
            ? 'border-ice-300/40 bg-ice-300/[0.12] text-ice-100'
            : 'border-white/10 text-steel-400 lg:group-hover:border-ice-300/30 lg:group-hover:text-steel-200'
        }`}
      >
        <FlameIcon className={`size-3.5 ${item.cheeredByMe ? 'text-ice-300' : ''}`} strokeWidth={2} />
        {item.cheers.length === 0 && <span>Cheer</span>}
        <CheerFaces people={item.cheers} />
      </span>
    </button>
  )
}

function FeedItem({ item, isYou, timezone, viewerId, onCheer }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-ink-900/70 px-3 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <Link
        to={`/people/${item.user.id}`}
        aria-label={isYou ? 'Your profile' : `${item.user.displayName}’s profile`}
        className="-m-0.5 shrink-0 rounded-full p-0.5 transition active:opacity-70"
      >
        <Avatar user={item.user} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-steel-300">
          <span className="font-semibold text-ice-50">{isYou ? 'You' : item.user.displayName}</span> completed{' '}
          <span className="font-medium break-words text-ice-100">{item.goal.title}</span>
        </p>
        {item.forYesterday && <p className="mt-0.5 text-xs text-steel-500">for yesterday</p>}
        {item.milestone && (
          <p className="mt-1.5">
            <MilestoneBadge streak={item.milestone} frequency={item.goal.frequency} />
          </p>
        )}
        <Cheers item={item} viewerId={viewerId} onCheer={onCheer} />
      </div>
      <time dateTime={item.completedAt} className="shrink-0 self-start pt-0.5 text-xs text-steel-500 tabular-nums">
        {formatTime(item.completedAt, timezone)}
      </time>
    </li>
  )
}

export default function ActivityFeed() {
  const { user } = useAuth()
  const [feed, setFeed] = useState(null)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState('')
  const pendingCount = useRef(0)
  const missedSync = useRef(false)

  function loadFeed(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    api('/feed')
      .then((result) => {
        if (!showSpinner && pendingCount.current > 0) {
          missedSync.current = true
          return
        }
        setFeed(result)
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
    loadFeed(true)
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        loadFeed(false)
      }
    }
    function handleActivity() {
      loadFeed(false)
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('winterarc:activity', handleActivity)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('winterarc:activity', handleActivity)
    }
  }, [user.timezone])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  function replaceItem(updated) {
    setFeed((current) => ({ ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }))
  }

  async function toggleCheer(item) {
    const cheering = !item.cheeredByMe
    const me = { id: user.id, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor }
    replaceItem({
      ...item,
      cheeredByMe: cheering,
      cheers: cheering ? [...item.cheers, me] : item.cheers.filter((person) => person.id !== user.id),
    })
    pendingCount.current++
    try {
      const result = await api(`/feed/${item.id}/cheer`, { method: cheering ? 'PUT' : 'DELETE' })
      replaceItem(result.item)
    } catch (error) {
      replaceItem(item)
      setToast(error.message)
    }
    pendingCount.current--
    if (pendingCount.current === 0 && missedSync.current) {
      missedSync.current = false
      loadFeed(false)
    }
  }

  return (
    <section className="mt-8 lg:mt-0">
      <SectionTitle>Activity</SectionTitle>
      {status === 'loading' && (
        <div className="flex items-center gap-3 px-1 py-4 text-sm text-steel-500" role="status">
          <div className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-ice-300" />
          Loading activity…
        </div>
      )}
      {status === 'error' && <ErrorState message={loadError} onRetry={() => loadFeed(true)} />}
      {status === 'ready' && feed.items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-steel-400">
          No check-offs yet. When you or your friends finish a goal, it shows up here.
        </p>
      )}
      {status === 'ready' && feed.items.length > 0 && (
        <div className="flex flex-col gap-5">
          {groupByDay(feed.items).map((group) => (
            <div key={group.day}>
              <p className="mb-2 px-1 text-xs font-medium text-steel-400">{dayHeading(group.day, feed)}</p>
              <ul className="stagger flex flex-col gap-2">
                {group.items.map((item) => (
                  <FeedItem
                    key={item.id}
                    item={item}
                    isYou={item.user.id === user.id}
                    timezone={user.timezone}
                    viewerId={user.id}
                    onCheer={toggleCheer}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Toast message={toast} />
    </section>
  )
}
