import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import Page from '../components/Page.jsx'
import GoalRow from '../components/GoalRow.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import { Segmented } from '../components/Form.jsx'
import { PencilIcon } from '../components/Icons.jsx'
import { EmptyState, ErrorState, LoadingState, Toast } from '../components/States.jsx'
import { daysUntilNewYear, formatDayLabel, isMonday } from '../dates.js'

function isGoalDone(goal, field) {
  return goal[field] || (goal.frequency === 'weekly' && goal.weekCount >= goal.timesPerWeek)
}

function GoalSection({ label, goals, field, finished, onToggle }) {
  if (goals.length === 0) {
    return null
  }
  return (
    <section className="mb-6">
      <h2
        className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500"
        style={{ viewTransitionName: `section-${label.toLowerCase()}` }}
      >
        {label}
      </h2>
      <div className="flex flex-col gap-2.5">
        {goals.map((goal) => (
          <GoalRow key={goal.id} goal={goal} done={goal[field]} finished={finished} onToggle={onToggle} />
        ))}
      </div>
    </section>
  )
}

export default function Today() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [day, setDay] = useState('today')
  const [pendingIds, setPendingIds] = useState([])
  const [holdIds, setHoldIds] = useState([])
  const [toast, setToast] = useState('')

  function loadGoals(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    api('/goals')
      .then((result) => {
        setData(result)
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
    loadGoals(true)
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        loadGoals(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [user.timezone])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  function replaceGoal(updatedGoal) {
    setData((current) => ({
      ...current,
      goals: current.goals.map((goal) => (goal.id === updatedGoal.id ? updatedGoal : goal)),
    }))
  }

  function releaseHold(goalId) {
    const moveGoal = () => flushSync(() => setHoldIds((ids) => ids.filter((id) => id !== goalId)))
    if (document.startViewTransition && document.visibilityState === 'visible') {
      document.startViewTransition(moveGoal)
    } else {
      moveGoal()
    }
  }

  async function toggleGoal(goal) {
    if (pendingIds.includes(goal.id)) {
      return
    }
    const field = day === 'today' ? 'doneToday' : 'doneYesterday'
    const date = day === 'today' ? data.today : data.yesterday
    const nowDone = !goal[field]
    const countsThisWeek = day === 'today' || !isMonday(data.today)

    const optimisticGoal = { ...goal, [field]: nowDone }
    if (goal.frequency === 'weekly' && countsThisWeek) {
      optimisticGoal.weekCount = goal.weekCount + (nowDone ? 1 : -1)
    }
    replaceGoal(optimisticGoal)
    setPendingIds((ids) => [...ids, goal.id])
    setHoldIds((ids) => [...ids, goal.id])
    setTimeout(() => releaseHold(goal.id), 600)

    try {
      const result = await api(`/goals/${goal.id}/complete`, { method: nowDone ? 'POST' : 'DELETE', body: { date } })
      replaceGoal(result.goal)
    } catch (error) {
      replaceGoal(goal)
      setToast(error.status === 0 ? `${error.message} That change was not saved.` : error.message)
      if (error.status === 400) {
        loadGoals(false)
      }
    }
    setPendingIds((ids) => ids.filter((id) => id !== goal.id))
  }

  const editLink = (
    <Link
      to="/goals"
      className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-steel-200 transition active:bg-white/5"
    >
      <PencilIcon className="size-4" />
      Edit
    </Link>
  )

  if (status === 'loading') {
    return (
      <Page eyebrow="Winter Arc" title="Today">
        <LoadingState message="Loading your goals…" />
      </Page>
    )
  }

  if (status === 'error') {
    return (
      <Page eyebrow="Winter Arc" title="Today">
        <ErrorState message={loadError} onRetry={() => loadGoals(true)} />
      </Page>
    )
  }

  const field = day === 'today' ? 'doneToday' : 'doneYesterday'
  const goals = data.goals
  const doneCount = goals.filter((goal) => isGoalDone(goal, field)).length
  const allDone = goals.length > 0 && doneCount === goals.length
  const shownDate = day === 'today' ? data.today : data.yesterday
  const isFinished = (goal) => isGoalDone(goal, field) && !holdIds.includes(goal.id)
  const openGoals = goals.filter((goal) => !isFinished(goal))
  const finishedGoals = goals.filter((goal) => isFinished(goal))
  const daysLeft = daysUntilNewYear(data.today)

  return (
    <Page eyebrow={formatDayLabel(shownDate)} title={day === 'today' ? 'Today' : 'Yesterday'} action={editLink}>
      <section className="relative mb-8 flex animate-fade-up flex-col items-center pt-4 pb-2 text-center">
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ice-400/10 blur-3xl"
          aria-hidden="true"
        />
        <p className="bg-gradient-to-b from-white via-ice-100 to-ice-400/70 bg-clip-text text-[132px] leading-[0.9] font-bold tracking-[-0.06em] text-transparent tabular-nums drop-shadow-[0_0_32px_rgb(132_197_255/0.25)]">
          {daysLeft}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-ice-300/50" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-steel-400">
            {daysLeft === 1 ? 'Day' : 'Days'} until Jan 1
          </p>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-ice-300/50" aria-hidden="true" />
        </div>
      </section>

      {goals.length === 0 ? (
        <EmptyState title="No goals yet" message="Add the habits you’ll hold yourself to until Jan 1.">
          <Link
            to="/goals"
            className="inline-flex h-12 items-center rounded-xl bg-ice-50 px-5 text-[15px] font-semibold text-black shadow-[0_0_28px_-8px_rgb(174_219_255/0.6)]"
          >
            Add your first goal
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <ProgressRing done={doneCount} total={goals.length} />
              <p className={`text-xs font-medium ${allDone ? 'text-ice-300' : 'text-steel-400'}`}>
                {allDone ? 'All done' : 'done'}
              </p>
            </div>
            <div className="flex-1">
              <Segmented
                label="Which day"
                value={day}
                onChange={setDay}
                options={[
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                ]}
              />
            </div>
          </div>
          <GoalSection
            label="Daily"
            goals={openGoals.filter((goal) => goal.frequency === 'daily')}
            field={field}
            onToggle={toggleGoal}
          />
          <GoalSection
            label="Weekly"
            goals={openGoals.filter((goal) => goal.frequency === 'weekly')}
            field={field}
            onToggle={toggleGoal}
          />
          <GoalSection label="Done" goals={finishedGoals} field={field} finished onToggle={toggleGoal} />
        </>
      )}
      <Toast message={toast} />
    </Page>
  )
}
