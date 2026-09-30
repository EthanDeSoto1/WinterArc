import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import Page from '../components/Page.jsx'
import GoalForm from '../components/GoalForm.jsx'
import { ArchiveIcon, PencilIcon, PlusIcon } from '../components/Icons.jsx'
import { EmptyState, ErrorState, LoadingState, Toast } from '../components/States.jsx'

function describeFrequency(goal) {
  return goal.frequency === 'daily' ? 'Every day' : `${goal.timesPerWeek}× per week`
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [toast, setToast] = useState('')

  function loadGoals() {
    setStatus('loading')
    api('/goals')
      .then((result) => {
        setGoals(result.goals)
        setStatus('ready')
      })
      .catch((error) => {
        setLoadError(error.message)
        setStatus('error')
      })
  }

  useEffect(() => {
    loadGoals()
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  async function createGoal(fields) {
    const result = await api('/goals', { method: 'POST', body: fields })
    setGoals([...goals, result.goal])
    setEditingId(null)
  }

  async function updateGoal(goalId, fields) {
    const result = await api(`/goals/${goalId}`, { method: 'PATCH', body: fields })
    setGoals(goals.map((goal) => (goal.id === goalId ? result.goal : goal)))
    setEditingId(null)
  }

  async function archiveGoal(goal) {
    const confirmed = window.confirm(`Archive “${goal.title}”? It leaves your list, but its history is kept.`)
    if (!confirmed) {
      return
    }
    try {
      await api(`/goals/${goal.id}/archive`, { method: 'POST' })
      setGoals(goals.filter((item) => item.id !== goal.id))
    } catch (error) {
      setToast(error.message)
    }
  }

  const doneLink = (
    <Link
      to="/"
      className="flex min-h-11 shrink-0 items-center rounded-full bg-ice-50 px-5 text-sm font-semibold text-black shadow-[0_0_24px_-8px_rgb(174_219_255/0.6)]"
    >
      Done
    </Link>
  )

  return (
    <Page eyebrow="Manage" title="Your goals" action={doneLink}>
      {status === 'loading' && <LoadingState message="Loading your goals…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={loadGoals} />}
      {status === 'ready' && (
        <div className="flex flex-col gap-2.5">
          {editingId === 'new' ? (
            <GoalForm submitLabel="Add goal" onSubmit={createGoal} onCancel={() => setEditingId(null)} />
          ) : (
            <button
              type="button"
              onClick={() => setEditingId('new')}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-[15px] font-medium text-steel-200 transition active:bg-white/[0.03]"
            >
              <PlusIcon className="size-5" />
              New goal
            </button>
          )}

          {goals.length === 0 && editingId !== 'new' && (
            <div className="mt-4">
              <EmptyState title="Nothing here yet" message="Try something like “Sleep 7-8 hours” or “Work out 3× per week”." />
            </div>
          )}

          {goals.map((goal) =>
            editingId === goal.id ? (
              <GoalForm
                key={goal.id}
                initialGoal={goal}
                submitLabel="Save"
                onSubmit={(fields) => updateGoal(goal.id, fields)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={goal.id}
                className="flex min-h-[4.25rem] items-center gap-2 rounded-2xl border border-white/[0.06] bg-ink-900/70 py-2 pr-2 pl-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ice-50">{goal.title}</p>
                  <p className="mt-1 text-xs text-steel-500">{describeFrequency(goal)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(goal.id)}
                  aria-label={`Edit ${goal.title}`}
                  className="flex size-11 items-center justify-center rounded-xl text-steel-400 transition active:bg-white/5 active:text-ice-100"
                >
                  <PencilIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => archiveGoal(goal)}
                  aria-label={`Archive ${goal.title}`}
                  className="flex size-11 items-center justify-center rounded-xl text-steel-400 transition active:bg-rose-500/10 active:text-rose-300"
                >
                  <ArchiveIcon className="size-5" />
                </button>
              </div>
            )
          )}
        </div>
      )}
      <Toast message={toast} />
    </Page>
  )
}
