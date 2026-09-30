import { useState } from 'react'
import { FlameIcon } from './Icons.jsx'

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

export function GoalMeta({ goal, noStreakText = 'Start a streak today' }) {
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
