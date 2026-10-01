import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import Page from '../components/Page.jsx'
import GoalRow, { AmountGoalRow, shownAmount } from '../components/GoalRow.jsx'
import MilestoneCelebration from '../components/Milestone.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import { Segmented } from '../components/Form.jsx'
import { PencilIcon } from '../components/Icons.jsx'
import { EmptyState, ErrorState, LoadingState, Toast } from '../components/States.jsx'
import { daysUntilNewYear, formatDayLabel, isMonday } from '../dates.js'

function isGoalDone(goal, field) {
  return goal[field] || (goal.frequency === 'weekly' && goal.weekCount >= goal.timesPerWeek)
}

function GoalSection({ label, goals, field, day, finished, onToggle, onAmount }) {
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
        {goals.map((goal) =>
          goal.target !== null ? (
            <AmountGoalRow
              key={goal.id}
              goal={goal}
              day={day}
              done={isGoalDone(goal, field)}
              finished={finished}
              onChange={onAmount}
            />
          ) : (
            <GoalRow key={goal.id} goal={goal} done={goal[field]} finished={finished} onToggle={onToggle} />
          ),
        )}
      </div>
    </section>
  )
}

const SEASON_DAYS = 92

function Reactor({ dayNumber }) {
  const ticks = Array.from({ length: SEASON_DAYS }, (_, index) => {
    const angle = (index / SEASON_DAYS) * 2 * Math.PI - Math.PI / 2
    const lit = index < dayNumber
    const current = index === dayNumber - 1
    return {
      x1: 160 + Math.cos(angle) * 134,
      y1: 160 + Math.sin(angle) * 134,
      x2: 160 + Math.cos(angle) * (current ? 150 : 145),
      y2: 160 + Math.sin(angle) * (current ? 150 : 145),
      stroke: current ? '#f4f9ff' : lit ? 'rgb(174 219 255 / 0.75)' : 'rgb(255 255 255 / 0.08)',
    }
  })
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 hidden size-80 -translate-x-1/2 -translate-y-1/2 lg:block" aria-hidden="true">
      <svg viewBox="0 0 320 320" className="absolute inset-0 animate-spin-slow">
        <circle cx="160" cy="160" r="157" fill="none" stroke="rgb(174 219 255 / 0.22)" strokeWidth="1" strokeDasharray="2 9" />
      </svg>
      <svg viewBox="0 0 320 320" className="absolute inset-0 drop-shadow-[0_0_6px_rgb(132_197_255/0.45)]">
        {ticks.map((tick, index) => (
          <line key={index} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke={tick.stroke} strokeWidth="1.5" strokeLinecap="round" />
        ))}
      </svg>
      <svg viewBox="0 0 320 320" className="absolute inset-0 animate-spin-reverse">
        <circle cx="160" cy="160" r="122" fill="none" stroke="rgb(174 219 255 / 0.16)" strokeWidth="1" strokeDasharray="60 14 4 14" />
      </svg>
    </div>
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
  const [celebration, setCelebration] = useState(null)
  const pendingCount = useRef(0)
  const amountQueues = useRef({})
  const amountSeq = useRef({})
  const missedSync = useRef(false)
  const latestData = useRef(null)
  latestData.current = data

  function applySynced(result) {
    if (JSON.stringify(result) === JSON.stringify(latestData.current)) {
      return
    }
    const update = () => flushSync(() => setData(result))
    if (document.startViewTransition && document.visibilityState === 'visible') {
      document.startViewTransition(update)
    } else {
      update()
    }
  }

  function loadGoals(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    api('/goals')
      .then((result) => {
        if (!showSpinner && pendingCount.current > 0) {
          missedSync.current = true
          return
        }
        if (!showSpinner && latestData.current) {
          applySynced(result)
          return
        }
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
    function handleActivity(event) {
      const userId = event.detail ? event.detail.userId : null
      if (userId === null || userId === user.id) {
        loadGoals(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('winterarc:activity', handleActivity)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('winterarc:activity', handleActivity)
    }
  }, [user.timezone, user.id])

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
    pendingCount.current++
    setPendingIds((ids) => [...ids, goal.id])
    setHoldIds((ids) => [...ids, goal.id])
    setTimeout(() => releaseHold(goal.id), 600)

    try {
      const result = await api(`/goals/${goal.id}/complete`, { method: nowDone ? 'POST' : 'DELETE', body: { date } })
      replaceGoal(result.goal)
      celebrate(result, goal)
    } catch (error) {
      replaceGoal(goal)
      setToast(error.status === 0 ? `${error.message} That change was not saved.` : error.message)
      if (error.status === 400) {
        loadGoals(false)
      }
    }
    setPendingIds((ids) => ids.filter((id) => id !== goal.id))
    pendingCount.current--
    if (pendingCount.current === 0 && missedSync.current) {
      missedSync.current = false
      loadGoals(false)
    }
  }

  function celebrate(result, goal) {
    if (result.milestone) {
      setCelebration({ streak: result.milestone, frequency: goal.frequency, title: goal.title })
    }
  }

  async function changeAmount(goal, total) {
    const field = day === 'today' ? 'doneToday' : 'doneYesterday'
    const date = day === 'today' ? data.today : data.yesterday
    const dayField = day === 'today' ? 'amountToday' : 'amountYesterday'
    const shown = shownAmount(goal, day)
    const dayAmount = Math.max(0, Math.round((total - (shown - goal[dayField])) * 100) / 100)
    const newShown = Math.round((shown - goal[dayField] + dayAmount) * 100) / 100

    const optimisticGoal = { ...goal, [dayField]: dayAmount }
    if (goal.frequency === 'daily') {
      optimisticGoal[field] = dayAmount >= goal.target
    } else {
      const sameWeek = !isMonday(data.today)
      if (day === 'today' || sameWeek) {
        optimisticGoal.weekAmount = newShown
        optimisticGoal.weekCount = newShown >= goal.target ? 1 : 0
      }
      if (day === 'yesterday' || sameWeek) {
        optimisticGoal.weekAmountYesterday = newShown
      }
    }
    if (isGoalDone(optimisticGoal, field) !== isGoalDone(goal, field)) {
      setHoldIds((ids) => [...ids, goal.id])
      setTimeout(() => releaseHold(goal.id), 600)
    }
    replaceGoal(optimisticGoal)

    const seq = (amountSeq.current[goal.id] || 0) + 1
    amountSeq.current[goal.id] = seq
    pendingCount.current++
    const previous = amountQueues.current[goal.id] || Promise.resolve()
    const request = previous.then(() => api(`/goals/${goal.id}/amount`, { method: 'PUT', body: { date, amount: dayAmount } }))
    amountQueues.current[goal.id] = request.catch(() => {})

    let failed = false
    try {
      const result = await request
      if (amountSeq.current[goal.id] === seq) {
        replaceGoal(result.goal)
      }
      celebrate(result, goal)
    } catch (error) {
      failed = true
      setToast(error.status === 0 ? `${error.message} That change was not saved.` : error.message)
    }
    pendingCount.current--
    if (failed || (pendingCount.current === 0 && missedSync.current)) {
      missedSync.current = false
      loadGoals(false)
    }
  }

  const editLink = (
    <Link
      to="/goals"
      className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-steel-200 transition active:bg-white/5 lg:hover:border-ice-300/30 lg:hover:bg-white/[0.04] lg:hover:text-ice-50"
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
  const dayNumber = SEASON_DAYS + 1 - daysLeft
  const inSeason = dayNumber >= 1 && dayNumber <= SEASON_DAYS

  return (
    <Page eyebrow={formatDayLabel(shownDate)} title={day === 'today' ? 'Today' : 'Yesterday'} action={editLink} wide>
      <div className="xl:grid xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:items-start xl:gap-14">
        <div className="xl:sticky xl:top-12">
          <section className="hud relative mb-8 flex animate-fade-up flex-col items-center pt-4 pb-2 text-center lg:mb-6 lg:h-[400px] lg:animate-rise-in lg:justify-center lg:rounded-3xl lg:border lg:border-white/[0.06] lg:bg-ink-900/40 lg:pt-0 lg:pb-0">
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ice-400/10 blur-3xl"
              aria-hidden="true"
            />
            <Reactor dayNumber={inSeason ? dayNumber : 0} />
            <p className="bg-gradient-to-b from-white via-ice-100 to-ice-400/70 bg-clip-text text-[132px] leading-[0.9] font-bold tracking-[-0.06em] text-transparent tabular-nums drop-shadow-[0_0_32px_rgb(132_197_255/0.25)] lg:text-[112px]">
              {daysLeft}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-ice-300/50" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-steel-400">
                {daysLeft === 1 ? 'Day' : 'Days'} until Jan 1
              </p>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-ice-300/50" aria-hidden="true" />
            </div>
            <p className="absolute inset-x-0 bottom-5 hidden font-mono text-[11px] uppercase tracking-[0.24em] text-steel-500 lg:block">
              {inSeason ? `Day ${dayNumber} / ${SEASON_DAYS}` : 'Season starts Oct 1'}
            </p>
          </section>

          {goals.length > 0 && (
            <div className="hud mb-6 flex items-center gap-4 lg:animate-rise-in lg:rounded-2xl lg:border lg:border-white/[0.06] lg:bg-ink-900/60 lg:p-5 lg:[animation-delay:80ms]">
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
          )}
        </div>

        <div className="lg:animate-rise-in lg:[animation-delay:120ms]">
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
              <GoalSection
                label="Daily"
                goals={openGoals.filter((goal) => goal.frequency === 'daily')}
                field={field}
                day={day}
                onToggle={toggleGoal}
                onAmount={changeAmount}
              />
              <GoalSection
                label="Weekly"
                goals={openGoals.filter((goal) => goal.frequency === 'weekly')}
                field={field}
                day={day}
                onToggle={toggleGoal}
                onAmount={changeAmount}
              />
              <GoalSection label="Done" goals={finishedGoals} field={field} day={day} finished onToggle={toggleGoal} onAmount={changeAmount} />
            </>
          )}
        </div>
      </div>
      <Toast message={toast} />
      <MilestoneCelebration celebration={celebration} onClose={() => setCelebration(null)} />
    </Page>
  )
}
