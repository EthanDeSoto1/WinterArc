import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import Page from '../components/Page.jsx'
import GoalForm from '../components/GoalForm.jsx'
import { SectionTitle } from '../components/PersonRow.jsx'
import { FormError, PrimaryButton, SecondaryButton, SmallButton } from '../components/Form.jsx'
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, ReorderIcon } from '../components/Icons.jsx'
import { EmptyState, ErrorState, LoadingState, Toast } from '../components/States.jsx'

const GROUPS = [
  { frequency: 'daily', label: 'Daily' },
  { frequency: 'weekly', label: 'Weekly' },
]

function describeFrequency(goal) {
  return goal.frequency === 'daily' ? 'Every day' : `${goal.timesPerWeek}× per week`
}

function GoalCard({ goal, children }) {
  return (
    <div className="flex min-h-[4.25rem] items-center gap-2 rounded-2xl border border-white/[0.06] bg-ink-900/70 py-2 pr-2 pl-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ice-50">{goal.title}</p>
        <p className="mt-1 text-xs text-steel-500">{describeFrequency(goal)}</p>
      </div>
      {children}
    </div>
  )
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [toast, setToast] = useState('')
  const [draft, setDraft] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [archived, setArchived] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [restoringId, setRestoringId] = useState(null)

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

  function loadArchived() {
    api('/goals/archived')
      .then((result) => setArchived(result.goals))
      .catch(() => {})
  }

  useEffect(() => {
    loadGoals()
    loadArchived()
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
    const confirmed = window.confirm(`Archive “${goal.title}”? It leaves your list, but its history is kept. You can restore it from Archived below.`)
    if (!confirmed) {
      return
    }
    try {
      await api(`/goals/${goal.id}/archive`, { method: 'POST' })
      setGoals(goals.filter((item) => item.id !== goal.id))
      loadArchived()
    } catch (error) {
      setToast(error.message)
    }
  }

  async function restoreGoal(goal) {
    setRestoringId(goal.id)
    try {
      const result = await api(`/goals/${goal.id}/restore`, { method: 'POST' })
      setGoals([...goals, result.goal])
      setArchived(archived.filter((item) => item.id !== goal.id))
    } catch (error) {
      setToast(error.message)
      loadArchived()
    }
    setRestoringId(null)
  }

  function startReorder() {
    setEditingId(null)
    setOrderError('')
    setDraft(goals)
  }

  function moveGoal(goal, direction) {
    const group = draft.filter((item) => item.frequency === goal.frequency)
    const other = group[group.indexOf(goal) + direction]
    if (!other) {
      return
    }
    setDraft(draft.map((item) => (item === goal ? other : item === other ? goal : item)))
  }

  async function saveOrder() {
    setOrderError('')
    setSavingOrder(true)
    const goalIds = GROUPS.flatMap((group) =>
      draft.filter((goal) => goal.frequency === group.frequency).map((goal) => goal.id)
    )
    try {
      const result = await api('/goals/order', { method: 'PUT', body: { goalIds } })
      setGoals(result.goals)
      setDraft(null)
    } catch (error) {
      setOrderError(error.message)
    }
    setSavingOrder(false)
  }

  const doneLink = (
    <Link
      to="/"
      className="flex min-h-11 shrink-0 items-center rounded-full bg-ice-50 px-5 text-sm font-semibold text-black shadow-[0_0_24px_-8px_rgb(174_219_255/0.6)]"
    >
      Done
    </Link>
  )

  if (draft) {
    return (
      <Page eyebrow="Manage" title="Reorder goals">
        <p className="mb-5 px-1 text-sm text-steel-400">Use the arrows to set the order your goals appear on Today.</p>
        {GROUPS.map((group) => {
          const groupGoals = draft.filter((goal) => goal.frequency === group.frequency)
          if (groupGoals.length === 0) {
            return null
          }
          return (
            <section key={group.frequency} className="mb-6">
              <SectionTitle>{group.label}</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {groupGoals.map((goal, index) => (
                  <GoalCard key={goal.id} goal={goal}>
                    <button
                      type="button"
                      onClick={() => moveGoal(goal, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${goal.title} up`}
                      className="flex size-11 items-center justify-center rounded-xl text-steel-300 transition active:bg-white/5 active:text-ice-100 disabled:opacity-25"
                    >
                      <ArrowUpIcon className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveGoal(goal, 1)}
                      disabled={index === groupGoals.length - 1}
                      aria-label={`Move ${goal.title} down`}
                      className="flex size-11 items-center justify-center rounded-xl text-steel-300 transition active:bg-white/5 active:text-ice-100 disabled:opacity-25"
                    >
                      <ArrowDownIcon className="size-5" />
                    </button>
                  </GoalCard>
                ))}
              </div>
            </section>
          )
        })}
        <div className="flex flex-col gap-3">
          <FormError message={orderError} />
          <div className="flex gap-3">
            <SecondaryButton type="button" className="flex-1" onClick={() => setDraft(null)} disabled={savingOrder}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="button" className="flex-1" onClick={saveOrder} disabled={savingOrder}>
              {savingOrder ? 'Saving…' : 'Save order'}
            </PrimaryButton>
          </div>
        </div>
      </Page>
    )
  }

  return (
    <Page eyebrow="Manage" title="Your goals" action={doneLink}>
      {status === 'loading' && <LoadingState message="Loading your goals…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={loadGoals} />}
      {status === 'ready' && (
        <div className="flex flex-col gap-2.5">
          {editingId === 'new' ? (
            <GoalForm submitLabel="Add goal" onSubmit={createGoal} onCancel={() => setEditingId(null)} />
          ) : (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setEditingId('new')}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-[15px] font-medium text-steel-200 transition active:bg-white/[0.03]"
              >
                <PlusIcon className="size-5" />
                New goal
              </button>
              {goals.length > 1 && (
                <button
                  type="button"
                  onClick={startReorder}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 text-[15px] font-medium text-steel-200 transition active:bg-white/[0.03]"
                >
                  <ReorderIcon className="size-5" />
                  Reorder
                </button>
              )}
            </div>
          )}

          {goals.length === 0 && editingId !== 'new' && (
            <div className="mt-4">
              <EmptyState title="Nothing here yet" message="Try something like “Sleep 7-8 hours” or “Work out 3× per week”." />
            </div>
          )}

          {GROUPS.map((group) => {
            const groupGoals = goals.filter((goal) => goal.frequency === group.frequency)
            if (groupGoals.length === 0) {
              return null
            }
            return (
              <section key={group.frequency} className="mt-4">
                <SectionTitle>{group.label}</SectionTitle>
                <div className="flex flex-col gap-2.5">
                  {groupGoals.map((goal) =>
                    editingId === goal.id ? (
                      <GoalForm
                        key={goal.id}
                        initialGoal={goal}
                        submitLabel="Save"
                        onSubmit={(fields) => updateGoal(goal.id, fields)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <GoalCard key={goal.id} goal={goal}>
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
                      </GoalCard>
                    )
                  )}
                </div>
              </section>
            )
          })}

          {archived.length > 0 && (
            <section className="mt-6">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                aria-expanded={showArchived}
                className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500 transition active:text-steel-300"
              >
                <span>Archived ({archived.length})</span>
                <span className="text-xs font-medium tracking-normal normal-case">{showArchived ? 'Hide' : 'Show'}</span>
              </button>
              {showArchived && (
                <div className="mt-2 flex flex-col gap-2.5">
                  <p className="px-1 text-xs text-steel-500">Restoring puts a goal back on Today. Its check-offs were kept.</p>
                  {archived.map((goal) => (
                    <GoalCard key={goal.id} goal={goal}>
                      <SmallButton onClick={() => restoreGoal(goal)} disabled={restoringId !== null}>
                        {restoringId === goal.id ? 'Restoring…' : 'Restore'}
                      </SmallButton>
                    </GoalCard>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
      <Toast message={toast} />
    </Page>
  )
}
