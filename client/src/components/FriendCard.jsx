import { useState } from 'react'
import { api } from '../api.js'
import { Avatar } from './PersonRow.jsx'
import { GoalMeta } from './GoalRow.jsx'
import { ChevronDownIcon } from './Icons.jsx'
import { ErrorState } from './States.jsx'

function isFinished(goal) {
  return goal.doneToday || (goal.frequency === 'weekly' && goal.weekCount >= goal.timesPerWeek)
}

function TodaySummary({ today }) {
  if (today.total === 0) {
    return <span className="text-xs text-steel-500">No goals</span>
  }
  if (today.done === today.total) {
    return <span className="text-xs font-semibold text-ice-300">All done</span>
  }
  return (
    <span className="text-xs text-steel-400">
      <span className="font-semibold text-ice-100 tabular-nums">
        {today.done}/{today.total}
      </span>{' '}
      today
    </span>
  )
}

function FriendGoalRow({ goal }) {
  const finished = isFinished(goal)
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-3">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          finished ? 'border-ice-100 bg-ice-100 text-black shadow-[0_0_12px_rgb(174_219_255/0.45)]' : 'border-steel-500/50'
        }`}
        aria-hidden="true"
      >
        {finished && (
          <svg viewBox="0 0 24 24" className="size-3.5">
            <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${finished ? 'text-steel-400 line-through decoration-steel-500/80' : 'text-ice-50'}`}>
          <span className="sr-only">{finished ? 'Done: ' : 'Not done: '}</span>
          {goal.title}
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs text-steel-500">
          <GoalMeta goal={goal} noStreakText="No streak yet" />
        </span>
      </span>
    </li>
  )
}

function FriendGoalList({ label, goals }) {
  if (goals.length === 0) {
    return null
  }
  return (
    <div>
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500">{label}</p>
      <ul className="flex flex-col gap-1.5">
        {goals.map((goal) => (
          <FriendGoalRow key={goal.id} goal={goal} />
        ))}
      </ul>
    </div>
  )
}

export default function FriendCard({ friend }) {
  const [open, setOpen] = useState(false)
  const [goals, setGoals] = useState(null)
  const [status, setStatus] = useState('idle')
  const [loadError, setLoadError] = useState('')

  function loadGoals() {
    setStatus('loading')
    api(`/friends/${friend.id}/goals`)
      .then((result) => {
        setGoals(result.goals)
        setStatus('ready')
      })
      .catch((error) => {
        setLoadError(error.message)
        setStatus('error')
      })
  }

  function toggle() {
    if (!open) {
      loadGoals()
    }
    setOpen(!open)
  }

  const panelId = `friend-${friend.id}-goals`

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-ink-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl py-2 pr-3 pl-3 text-left transition active:bg-white/[0.03]"
      >
        <Avatar user={friend} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ice-50">{friend.displayName}</span>
          <span className="block truncate text-xs text-steel-500">@{friend.username}</span>
        </span>
        <TodaySummary today={friend.today} />
        <ChevronDownIcon className={`size-5 shrink-0 text-steel-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={panelId} className="animate-fade-up border-t border-white/[0.06] p-3">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-6 text-sm text-steel-500" role="status">
              <div className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-ice-300" />
              Loading goals…
            </div>
          )}
          {status === 'error' && <ErrorState message={loadError} onRetry={loadGoals} />}
          {status === 'ready' && goals.length === 0 && (
            <p className="py-5 text-center text-sm text-steel-400">{friend.displayName} hasn’t added any goals yet.</p>
          )}
          {status === 'ready' && goals.length > 0 && (
            <div className="flex flex-col gap-4">
              <FriendGoalList label="Daily" goals={goals.filter((goal) => goal.frequency === 'daily')} />
              <FriendGoalList label="Weekly" goals={goals.filter((goal) => goal.frequency === 'weekly')} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
