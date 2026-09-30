import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Page from '../components/Page.jsx'
import { SectionTitle } from '../components/PersonRow.jsx'
import { CheckIcon, CrossIcon } from '../components/Icons.jsx'
import { ErrorState, LoadingState } from '../components/States.jsx'
import { dayOfMonth, formatDayLabel, formatMonthName, formatShortDate } from '../dates.js'

const DAY_STYLES = {
  full: { dot: 'bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.7)]', label: 'All done', text: 'text-emerald-300' },
  partial: { dot: 'bg-amber-300 shadow-[0_0_8px_rgb(252_211_77/0.6)]', label: 'Most done', text: 'text-amber-200' },
  low: { dot: 'bg-rose-500 shadow-[0_0_8px_rgb(244_63_94/0.6)]', label: 'Fell short', text: 'text-rose-300' },
  today: { dot: 'border border-steel-400', label: 'In progress', text: 'text-steel-300' },
}

const WEEK_STYLES = {
  met: { label: 'Weekly goals met', text: 'text-emerald-300' },
  missed: { label: 'Weekly goal missed', text: 'text-rose-300' },
  inProgress: { label: 'In progress', text: 'text-steel-300' },
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function monthLabel(week, index) {
  const labels = []
  const firstInRange = week.days.find((day) => !day.outside)
  if (index === 0 && firstInRange) {
    labels.push(formatMonthName(firstInRange.date))
  }
  const firstOfMonth = week.days.find((day) => !day.outside && dayOfMonth(day.date) === 1)
  if (firstOfMonth && !labels.includes(formatMonthName(firstOfMonth.date))) {
    labels.push(formatMonthName(firstOfMonth.date))
  }
  return labels.join(' · ')
}

function StatusChip({ style }) {
  if (!style) {
    return null
  }
  return <span className={`shrink-0 text-xs font-semibold uppercase tracking-[0.14em] ${style.text}`}>{style.label}</span>
}

function GoalLine({ title, state, extra }) {
  const icons = {
    done: (
      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
        <CheckIcon className="size-3.5" strokeWidth={2.5} />
      </span>
    ),
    missed: (
      <span className="flex size-6 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
        <CrossIcon className="size-3.5" strokeWidth={2.5} />
      </span>
    ),
    open: <span className="size-6 rounded-full border border-dashed border-steel-500" />,
    bonus: (
      <span className="flex size-6 items-center justify-center rounded-full bg-ice-300/15 text-ice-200">
        <CheckIcon className="size-3.5" strokeWidth={2.5} />
      </span>
    ),
  }
  return (
    <li className="flex min-h-11 items-center gap-3">
      {icons[state]}
      <span className={`min-w-0 flex-1 truncate text-[15px] ${state === 'missed' ? 'text-steel-300' : 'text-ice-50'}`}>
        {title}
      </span>
      {extra && <span className="shrink-0 text-sm tabular-nums text-steel-400">{extra}</span>}
    </li>
  )
}

function goalTitle(goal) {
  return goal.archived ? `${goal.title} (archived)` : goal.title
}

function DayDetail({ day, goalsById, isToday }) {
  const total = day.done.length + day.missed.length
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ice-50">{formatDayLabel(day.date)}</p>
          <p className="mt-1 text-sm text-steel-400">
            {total === 0 ? 'No daily goals this day' : `${day.done.length} of ${total} daily goals`}
          </p>
        </div>
        <StatusChip style={DAY_STYLES[day.status]} />
      </div>
      {(total > 0 || day.weeklyDone.length > 0) && (
        <ul className="mt-3 flex flex-col">
          {day.done.map((id) => (
            <GoalLine key={id} title={goalTitle(goalsById[id])} state="done" />
          ))}
          {day.missed.map((id) => (
            <GoalLine key={id} title={goalTitle(goalsById[id])} state={isToday ? 'open' : 'missed'} />
          ))}
          {day.weeklyDone.map((id) => (
            <GoalLine key={id} title={goalTitle(goalsById[id])} state="bonus" extra="weekly" />
          ))}
        </ul>
      )}
    </>
  )
}

function WeekDetail({ week, goalsById }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ice-50">
            {formatShortDate(week.start)} – {formatShortDate(week.days[6].date)}
          </p>
          <p className="mt-1 text-sm text-steel-400">Weekly goals</p>
        </div>
        <StatusChip style={WEEK_STYLES[week.status]} />
      </div>
      <ul className="mt-3 flex flex-col">
        {week.goals.map((result) => (
          <GoalLine
            key={result.id}
            title={goalTitle(goalsById[result.id])}
            state={result.met ? 'done' : week.status === 'inProgress' ? 'open' : 'missed'}
            extra={`${result.count}/${result.target}`}
          />
        ))}
      </ul>
    </>
  )
}

function WeekMarker({ week, selected, onSelect }) {
  if (!week.status) {
    return <div className="h-11" />
  }
  const looks = {
    met: 'bg-emerald-400/15 text-emerald-300',
    missed: 'bg-rose-500/15 text-rose-300',
    inProgress: 'border border-dashed border-steel-500 text-transparent',
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Week of ${formatShortDate(week.start)}: ${WEEK_STYLES[week.status].label}`}
      aria-pressed={selected}
      className={`flex h-11 w-full items-center justify-center rounded-xl transition ${selected ? 'bg-white/[0.08]' : 'active:bg-white/5'}`}
    >
      <span className={`flex size-6 items-center justify-center rounded-full ${looks[week.status]}`}>
        {week.status === 'met' && <CheckIcon className="size-3.5" strokeWidth={2.5} />}
        {week.status === 'missed' && <CrossIcon className="size-3.5" strokeWidth={2.5} />}
      </span>
    </button>
  )
}

function DayCell({ day, isToday, selected, onSelect }) {
  const style = DAY_STYLES[day.status]
  const firstOfMonth = dayOfMonth(day.date) === 1 && !day.outside
  const number = firstOfMonth ? formatShortDate(day.date) : dayOfMonth(day.date)
  let numberColor = day.tracked ? 'text-steel-200' : 'text-steel-500'
  if (day.outside) {
    numberColor = 'text-steel-500/40'
  } else if (firstOfMonth) {
    numberColor = 'font-semibold text-ice-200'
  }
  const content = (
    <>
      <span className={`whitespace-nowrap text-[13px] leading-none tabular-nums ${isToday ? 'font-bold text-ice-50' : numberColor}`}>{number}</span>
      <span className={`mt-1.5 size-1.5 rounded-full ${style ? style.dot : ''}`} />
    </>
  )
  if (!day.tracked) {
    return <div className="flex h-11 flex-col items-center justify-center">{content}</div>
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${formatDayLabel(day.date)}${style ? `: ${style.label}` : ''}`}
      aria-pressed={selected}
      className={`flex h-11 flex-col items-center justify-center rounded-xl transition ${
        selected ? 'bg-white/[0.08]' : 'active:bg-white/5'
      } ${isToday ? 'ring-1 ring-ice-300/50 ring-inset' : ''}`}
    >
      {content}
    </button>
  )
}

function Summary({ weeks }) {
  const days = weeks.flatMap((week) => week.days)
  const count = (status) => days.filter((day) => day.status === status).length
  const gradedWeeks = weeks.filter((week) => week.status === 'met' || week.status === 'missed')
  const metWeeks = gradedWeeks.filter((week) => week.status === 'met').length
  const items = [
    { status: 'full', value: count('full') },
    { status: 'partial', value: count('partial') },
    { status: 'low', value: count('low') },
  ]
  return (
    <div className="mb-7 rounded-2xl border border-white/[0.06] bg-ink-900/70 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.status} className="flex flex-col items-center gap-1.5">
            <span className="text-[28px] font-semibold leading-none tabular-nums text-ice-50">{item.value}</span>
            <span className="flex items-center gap-1.5 text-xs text-steel-400">
              <span className={`size-1.5 rounded-full ${DAY_STYLES[item.status].dot}`} />
              {DAY_STYLES[item.status].label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-center text-sm text-steel-400">
        {gradedWeeks.length === 0
          ? 'Weekly goals are graded at the end of each week'
          : `Weekly goals met ${metWeeks} of ${gradedWeeks.length} ${gradedWeeks.length === 1 ? 'week' : 'weeks'}`}
      </p>
    </div>
  )
}

export default function History() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(null)

  function loadHistory() {
    setStatus('loading')
    api('/history')
      .then((result) => {
        setData(result)
        setSelected({ type: 'day', key: result.today })
        setStatus('ready')
      })
      .catch((error) => {
        setLoadError(error.message)
        setStatus('error')
      })
  }

  useEffect(() => {
    loadHistory()
  }, [])

  if (status !== 'ready') {
    return (
      <Page eyebrow="Winter Arc" title="History">
        {status === 'loading' && <LoadingState message="Loading your history…" />}
        {status === 'error' && <ErrorState message={loadError} onRetry={loadHistory} />}
      </Page>
    )
  }

  const goalsById = Object.fromEntries(data.goals.map((goal) => [goal.id, goal]))

  function isSelected(type, key) {
    return selected !== null && selected.type === type && selected.key === key
  }

  function toggle(type, key) {
    setSelected(isSelected(type, key) ? null : { type, key })
  }

  return (
    <Page eyebrow="Winter Arc" title="History">
      <Summary weeks={data.weeks} />

      <SectionTitle>Calendar</SectionTitle>
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_3rem] text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-steel-500">
        {WEEKDAYS.map((weekday, index) => (
          <span key={index} className="py-2">
            {weekday}
          </span>
        ))}
        <span className="border-l border-white/[0.06] py-2">Wk</span>
      </div>

      {data.weeks.map((week, index) => {
        const label = monthLabel(week, index)
        const selectedDay = week.days.find((day) => isSelected('day', day.date))
        const weekSelected = isSelected('week', week.start)
        return (
          <div key={week.start}>
            {label && (
              <p className="mt-3 mb-1 px-1 text-[13px] font-semibold tracking-tight text-ice-100">{label}</p>
            )}
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_3rem]">
              {week.days.map((day) => (
                <DayCell
                  key={day.date}
                  day={day}
                  isToday={day.date === data.today}
                  selected={selectedDay === day}
                  onSelect={() => toggle('day', day.date)}
                />
              ))}
              <div className="border-l border-white/[0.06]">
                <WeekMarker week={week} selected={weekSelected} onSelect={() => toggle('week', week.start)} />
              </div>
            </div>
            {(selectedDay || weekSelected) && (
              <div
                className="my-2 animate-fade-up rounded-2xl border border-white/[0.06] bg-ink-900/70 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
                aria-live="polite"
              >
                {selectedDay && <DayDetail day={selectedDay} goalsById={goalsById} isToday={selectedDay.date === data.today} />}
                {weekSelected && <WeekDetail week={week} goalsById={goalsById} />}
              </div>
            )}
          </div>
        )
      })}

      <p className="mt-6 px-1 text-center text-xs text-steel-500">Tap a day or a week to see what you did.</p>
    </Page>
  )
}
