import { useEffect, useState } from 'react'
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

function GoalSection({ label, goals, field, onToggle }) {
  if (goals.length === 0) {
    return null
  }
  return (
    <section className="mb-6">
      <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500">{label}</h2>
      <div className="flex flex-col gap-2.5">
        {goals.map((goal) => (
          <GoalRow key={goal.id} goal={goal} done={goal[field]} onToggle={onToggle} />
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

  return (
    <Page eyebrow={formatDayLabel(shownDate)} title={day === 'today' ? 'Today' : 'Yesterday'} action={editLink}>
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-ink-800/80 to-ink-900/80 px-5 py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
        <div>
          <p className="text-[44px] font-extralight leading-none tracking-tight text-ice-50 tabular-nums">
            {daysUntilNewYear(data.today)}
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500">Days until Jan 1</p>
        </div>
        {goals.length > 0 && (
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing done={doneCount} total={goals.length} />
            <p className={`text-xs font-medium ${allDone ? 'text-ice-300' : 'text-steel-400'}`}>
              {allDone ? 'All done' : 'done'}
            </p>
          </div>
        )}
      </div>

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
          <div className="mb-6">
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
          <GoalSection
            label="Daily"
            goals={goals.filter((goal) => goal.frequency === 'daily')}
            field={field}
            onToggle={toggleGoal}
          />
          <GoalSection
            label="Weekly"
            goals={goals.filter((goal) => goal.frequency === 'weekly')}
            field={field}
            onToggle={toggleGoal}
          />
        </>
      )}
      <Toast message={toast} />
    </Page>
  )
}
