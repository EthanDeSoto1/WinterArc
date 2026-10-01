import { useState } from 'react'
import { FlameIcon } from './Icons.jsx'

export function formatAmount(value) {
  return String(Math.round(value * 100) / 100)
}

export function shownAmount(goal, day = 'today') {
  if (goal.frequency === 'daily') {
    return day === 'today' ? goal.amountToday : goal.amountYesterday
  }
  return day === 'today' ? goal.weekAmount : goal.weekAmountYesterday
}

function AmountText({ goal, day }) {
  const amount = shownAmount(goal, day)
  const reached = amount >= goal.target
  return (
    <span className={`tabular-nums ${reached ? 'text-ice-300' : ''}`}>
      {formatAmount(amount)}/{formatAmount(goal.target)}
      {goal.unit ? ` ${goal.unit}` : ''}
      {goal.frequency === 'weekly' ? ' this week' : ''}
    </span>
  )
}

function WeekPips({ count, target }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: target }, (_, index) => (
        <span
          key={index}
          className={`size-1.5 rounded-full ${index < count ? 'bg-ice-300 shadow-[0_0_6px_rgb(174_219_255/0.7)]' : 'bg-white/15'}`}
        />
      ))}
    </span>
  )
}

function StreakBadge({ streak, unit }) {
  if (streak === 0) {
    return null
  }
  return (
    <span className="flex items-center gap-1 text-ice-300">
      <FlameIcon className="size-3.5" strokeWidth={2} />
      {streak} {unit} streak
    </span>
  )
}

export function GoalMeta({ goal, day = 'today', noStreakText = 'Start a streak today' }) {
  if (goal.target !== null) {
    return (
      <>
        <AmountText goal={goal} day={day} />
        {goal.streak > 0 && <span className="text-white/15">·</span>}
        <StreakBadge streak={goal.streak} unit={goal.frequency === 'daily' ? 'day' : 'week'} />
      </>
    )
  }
  if (goal.frequency === 'daily') {
    return goal.streak > 0 ? <StreakBadge streak={goal.streak} unit="day" /> : <span>{noStreakText}</span>
  }
  return (
    <>
      <WeekPips count={goal.weekCount} target={goal.timesPerWeek} />
      <span className={goal.weekCount >= goal.timesPerWeek ? 'text-ice-300' : ''}>
        {goal.weekCount}/{goal.timesPerWeek} this week
      </span>
      {goal.streak > 0 && <span className="text-white/15">·</span>}
      <StreakBadge streak={goal.streak} unit="week" />
    </>
  )
}

function AmountProgress({ amount, target, done }) {
  const fraction = Math.min(amount / target, 1)
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center" aria-hidden="true">
      {done ? (
        <span className="flex size-8 items-center justify-center rounded-full border-[1.5px] border-ice-100 bg-ice-100 text-black shadow-[0_0_18px_rgb(174_219_255/0.55)]">
          <svg viewBox="0 0 24 24" className="size-[18px]">
            <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <svg viewBox="0 0 32 32" className="size-8 -rotate-90">
          <circle cx="16" cy="16" r="14.25" fill="none" stroke="rgb(107 115 130 / 0.5)" strokeWidth="1.5" />
          <circle
            cx="16"
            cy="16"
            r="14.25"
            fill="none"
            stroke="#aedbff"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${fraction * 100} 100`}
            className="transition-[stroke-dasharray] duration-300"
          />
        </svg>
      )}
    </span>
  )
}

export function AmountGoalRow({ goal, day, done, finished = false, onChange }) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const amount = shownAmount(goal, day)
  const label = goal.unit || 'amount'

  function startTyping() {
    setDraft(formatAmount(amount))
    setTyping(true)
  }

  function finishTyping() {
    setTyping(false)
    const value = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(value) && value >= 0 && value !== amount) {
      onChange(goal, value)
    }
  }

  function step(change) {
    if (navigator.vibrate) {
      navigator.vibrate(8)
    }
    onChange(goal, Math.max(0, amount + change))
  }

  return (
    <div
      style={{ viewTransitionName: `goal-${goal.id}` }}
      className={`flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border py-2.5 pr-2 pl-4 transition duration-300 ${
        done
          ? 'border-ice-300/15 bg-ice-300/[0.035]'
          : 'border-white/[0.06] bg-ink-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]'
      } ${finished ? 'opacity-75' : ''} lg:hover:border-ice-300/30`}
    >
      <AmountProgress amount={amount} target={goal.target} done={done} />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-medium ${done || finished ? 'text-steel-400' : 'text-ice-50'} ${
            finished ? 'line-through decoration-steel-500/80' : ''
          }`}
        >
          {goal.title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-steel-500">
          <GoalMeta goal={goal} day={day} />
        </span>
      </span>
      <span className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={amount <= 0}
          aria-label={`Less ${label} for ${goal.title}`}
          className="flex size-11 items-center justify-center rounded-xl text-xl text-steel-300 transition active:scale-95 active:bg-white/5 disabled:opacity-30"
        >
          −
        </button>
        {typing ? (
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={finishTyping}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                setDraft(formatAmount(amount))
                setTyping(false)
              }
            }}
            aria-label={`${goal.title}: ${goal.frequency === 'weekly' ? 'total this week' : 'amount'}`}
            autoFocus
            className="h-11 w-14 rounded-lg border border-ice-400/60 bg-ink-950 text-center text-base font-semibold text-ice-50 tabular-nums focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startTyping}
            aria-label={`${goal.title}: ${formatAmount(amount)} of ${formatAmount(goal.target)}${goal.unit ? ` ${goal.unit}` : ''}. Tap to type an amount`}
            className="h-11 min-w-11 rounded-lg px-1 text-[17px] font-semibold text-ice-50 tabular-nums transition active:bg-white/5"
          >
            {formatAmount(amount)}
          </button>
        )}
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`More ${label} for ${goal.title}`}
          className="flex size-11 items-center justify-center rounded-xl text-xl text-ice-100 transition active:scale-95 active:bg-white/5"
        >
          +
        </button>
      </span>
    </div>
  )
}

export default function GoalRow({ goal, done, finished = false, onToggle }) {
  const [checkCount, setCheckCount] = useState(0)
  const animate = done && checkCount > 0

  function handleClick() {
    if (!done) {
      setCheckCount(checkCount + 1)
      if (navigator.vibrate) {
        navigator.vibrate(12)
      }
    }
    onToggle(goal)
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      onClick={handleClick}
      style={{ viewTransitionName: `goal-${goal.id}` }}
      className={`flex min-h-[4.25rem] w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition duration-300 active:scale-[0.985] ${
        done
          ? 'border-ice-300/15 bg-ice-300/[0.035]'
          : 'border-white/[0.06] bg-ink-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] lg:hover:bg-ink-800/70'
      } ${finished ? 'opacity-75' : ''} lg:hover:border-ice-300/30 lg:hover:shadow-[0_12px_40px_-20px_rgb(132_197_255/0.6)]`}
    >
      <span className="relative flex size-8 shrink-0 items-center justify-center">
        {animate && <span key={`burst-${checkCount}`} className="absolute inset-0 animate-ring-burst rounded-full border border-ice-200" />}
        <span
          key={`box-${checkCount}`}
          className={`flex size-8 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200 ${
            done
              ? `border-ice-100 bg-ice-100 text-black shadow-[0_0_18px_rgb(174_219_255/0.55)] ${animate ? 'animate-check-pop' : ''}`
              : 'border-steel-500/50'
          }`}
        >
          {done && (
            <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
              <path
                d="m5 12.5 4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="22"
                className={animate ? 'animate-draw-check' : ''}
              />
            </svg>
          )}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-medium transition-colors ${done || finished ? 'text-steel-400' : 'text-ice-50'} ${
            finished ? 'line-through decoration-steel-500/80' : ''
          }`}
        >
          {goal.title}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-xs text-steel-500">
          <GoalMeta goal={goal} />
        </span>
      </span>
    </button>
  )
}
