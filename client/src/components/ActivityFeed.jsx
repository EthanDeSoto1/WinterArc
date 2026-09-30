import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import { Avatar, SectionTitle } from './PersonRow.jsx'
import { ErrorState } from './States.jsx'
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

function FeedItem({ item, isYou, timezone }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-ink-900/70 px-3 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <Avatar user={item.user} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-steel-300">
          <span className="font-semibold text-ice-50">{isYou ? 'You' : item.user.displayName}</span> completed{' '}
          <span className="font-medium break-words text-ice-100">{item.goal.title}</span>
        </p>
        {item.forYesterday && <p className="mt-0.5 text-xs text-steel-500">for yesterday</p>}
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

  function loadFeed(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    api('/feed')
      .then((result) => {
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
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [user.timezone])

  return (
    <section className="mt-8">
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
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <FeedItem key={item.id} item={item} isYou={item.user.id === user.id} timezone={user.timezone} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
