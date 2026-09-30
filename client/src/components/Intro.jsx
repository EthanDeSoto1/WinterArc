import { useEffect, useState } from 'react'
import ProgressRing from './ProgressRing.jsx'
import { Avatar } from './PersonRow.jsx'
import { CheckIcon, FlameIcon } from './Icons.jsx'

const SLIDE_MS = 6500
const STEP_MS = 650

const cardClasses = 'rounded-2xl border border-white/[0.06] bg-ink-900/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]'

const PEOPLE = {
  sam: { id: 1, displayName: 'Sam', avatarColor: 'ember' },
  jordan: { id: 2, displayName: 'Jordan', avatarColor: 'aurora' },
  riley: { id: 3, displayName: 'Riley', avatarColor: 'nebula' },
  you: { id: 4, displayName: 'You', avatarColor: 'frost' },
}

function Rise({ delay = 0, show = true, className = '', children }) {
  if (!show) {
    return null
  }
  return (
    <div className={`animate-rise-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function CheckCircle({ done }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
        done ? 'animate-check-pop border-ice-300/60 bg-ice-300 text-black shadow-[0_0_16px_-4px_rgb(174_219_255/0.8)]' : 'border-white/15 text-transparent'
      }`}
    >
      <CheckIcon className="size-5" />
    </span>
  )
}

function MockGoal({ title, meta, done, delay }) {
  return (
    <Rise delay={delay}>
      <div className={`${cardClasses} flex items-center gap-3 px-4 py-3`}>
        <CheckCircle done={done} />
        <div className="min-w-0 flex-1 text-left">
          <p className={`truncate text-[15px] font-medium transition-colors ${done ? 'text-steel-500 line-through' : 'text-ice-50'}`}>{title}</p>
          <p className="text-xs text-steel-500">{meta}</p>
        </div>
      </div>
    </Rise>
  )
}

function WelcomeScene({ step }) {
  const days = Math.max(92, 100 - step * 2)
  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full border border-dashed border-ice-300/20" />
      <div className="absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 animate-spin-reverse rounded-full border border-dotted border-ice-300/25" />
      <img src="/icon.svg" alt="" className="relative size-20 rounded-3xl shadow-[0_0_48px_-6px_rgb(132_197_255/0.7)]" />
      <p className="relative mt-5 bg-gradient-to-b from-white via-ice-100 to-ice-400/70 bg-clip-text text-[88px] leading-[0.9] font-bold tracking-[-0.06em] text-transparent tabular-nums drop-shadow-[0_0_32px_rgb(132_197_255/0.25)]">
        {days}
      </p>
      <p className="relative mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-400">days · Oct 1 → Jan 1</p>
    </div>
  )
}

function GoalsScene() {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <MockGoal title="Work out" meta="Every day" delay={0} />
      <MockGoal title="Read 20 pages" meta="Every day" delay={350} />
      <MockGoal title="No junk food" meta="Every day" delay={700} />
      <MockGoal title="Long run" meta="3× per week" delay={1050} />
    </div>
  )
}

function CheckScene({ step }) {
  const done = Math.min(3, Math.max(0, step - 1))
  const titles = ['Work out', 'Read 20 pages', 'No junk food']
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <ProgressRing done={done} total={3} />
        <div className="text-left">
          <p className="text-[15px] font-semibold text-ice-50">{done === 3 ? 'All done today' : `${3 - done} left today`}</p>
          <p className={`mt-1 flex items-center gap-1.5 text-sm transition-colors ${done === 3 ? 'text-ice-300' : 'text-steel-500'}`}>
            <FlameIcon className="size-4" />
            {done === 3 ? '13-day streak' : '12-day streak'}
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5">
        {titles.map((title, index) => (
          <MockGoal key={title} title={title} meta="Every day" done={index < done} delay={index * 150} />
        ))}
      </div>
    </div>
  )
}

function MockFriend({ person, text, delay }) {
  return (
    <Rise delay={delay}>
      <div className={`${cardClasses} flex items-center gap-3 px-3 py-2.5`}>
        <Avatar user={person} />
        <p className="flex-1 text-left text-[15px] font-medium text-ice-50">{person.displayName}</p>
        <p className="text-sm font-semibold text-steel-300 tabular-nums">{text}</p>
      </div>
    </Rise>
  )
}

function FriendsScene({ step }) {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <MockFriend person={PEOPLE.sam} text="All done" delay={0} />
      <MockFriend person={PEOPLE.jordan} text={step >= 5 ? '3/4 today' : '2/4 today'} delay={250} />
      <MockFriend person={PEOPLE.riley} text="1/3 today" delay={500} />
      <Rise show={step >= 5} className="mt-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left">
          <Avatar user={PEOPLE.jordan} small />
          <p className="text-sm text-steel-300">
            <span className="font-semibold text-ice-100">Jordan</span> completed Read 20 pages
          </p>
          <span className="ml-auto text-xs text-steel-500">now</span>
        </div>
      </Rise>
    </div>
  )
}

function BoardScene({ step }) {
  const fire = [PEOPLE.sam, PEOPLE.jordan, PEOPLE.you].slice(0, Math.min(3, Math.max(1, step - 1)))
  return (
    <Rise className="w-full">
      <div className={`${cardClasses} p-4 text-left`}>
        <div className="flex items-center gap-3">
          <Avatar user={PEOPLE.riley} />
          <div>
            <p className="text-[15px] font-medium text-ice-50">Riley</p>
            <p className="text-xs text-steel-500">Today · 7:42 AM</p>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-steel-200">5 AM run in the snow. Day 1 done.</p>
        <div className="mt-3 flex gap-2">
          <span className="flex min-h-10 items-center gap-2 rounded-full border border-ice-300/40 bg-ice-300/[0.1] px-3">
            <span aria-hidden="true">🔥</span>
            <span className="flex -space-x-1.5">
              {fire.map((person) => (
                <Avatar key={person.id} user={person} small className="animate-check-pop ring-2 ring-ink-900" />
              ))}
            </span>
          </span>
          <span className="flex min-h-10 items-center rounded-full border border-white/[0.08] px-3">💪</span>
          <span className="flex min-h-10 items-center rounded-full border border-white/[0.08] px-3">👏</span>
        </div>
        <Rise show={step >= 4} className="mt-3 border-t border-white/[0.06] pt-3">
          <div className="flex items-start gap-2.5">
            <Avatar user={PEOPLE.sam} small className="mt-1" />
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <p className="text-xs font-semibold text-ice-100">Sam</p>
              <p className="text-sm text-steel-200">Let’s go! See you out there tomorrow.</p>
            </div>
          </div>
        </Rise>
      </div>
    </Rise>
  )
}

const CALENDAR = ['g', 'g', 'y', 'g', 'g', 'r', 'g', 'g', 'g', 'y', 'g', 'g', 'g', 'g', 'y', 'g', 'g', 'g', 'r', 'g', 'g']
const DOT_COLORS = { g: 'bg-emerald-400/80', y: 'bg-amber-300/80', r: 'bg-rose-400/70' }

function HistoryScene({ step }) {
  const ranks = [
    { person: PEOPLE.sam, percent: 94 },
    { person: PEOPLE.you, percent: 88 },
    { person: PEOPLE.jordan, percent: 71 },
  ]
  return (
    <div className="flex w-full flex-col gap-4">
      <div className={`${cardClasses} grid grid-cols-7 gap-2 p-4`}>
        {CALENDAR.map((color, index) => (
          <span
            key={index}
            className={`mx-auto size-5 animate-rise-in rounded-full ${DOT_COLORS[color]}`}
            style={{ animationDelay: `${index * 60}ms` }}
          />
        ))}
      </div>
      <Rise show={step >= 4} className="flex flex-col gap-2">
        {ranks.map((rank, index) => (
          <div key={rank.person.id} className={`${cardClasses} flex items-center gap-3 px-3 py-2`}>
            <span className="w-4 text-sm font-semibold text-steel-400 tabular-nums">{index + 1}</span>
            <Avatar user={rank.person} small />
            <span className="flex-1 text-left text-sm font-medium text-ice-50">{rank.person.displayName}</span>
            <span className="text-sm font-semibold text-ice-200 tabular-nums">{rank.percent}%</span>
          </div>
        ))}
      </Rise>
    </div>
  )
}

function MockNotification({ title, body, delay }) {
  return (
    <Rise delay={delay}>
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-ink-800/90 p-3 text-left shadow-2xl backdrop-blur">
        <img src="/icon.svg" alt="" className="size-9 rounded-xl" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ice-50">{title}</p>
          <p className="text-sm text-steel-300">{body}</p>
        </div>
      </div>
    </Rise>
  )
}

function NotifyScene() {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <MockNotification title="Evening check-in" body="2 goals left today: Read 20 pages and No junk food" delay={0} />
      <MockNotification title="Sam finished the day" body="All 4 goals done today" delay={900} />
      <MockNotification title="Riley posted on the Board" body="5 AM run in the snow. Day 1 done." delay={1800} />
    </div>
  )
}

const SLIDES = [
  {
    eyebrow: 'Welcome',
    title: 'This is your Winter Arc',
    text: '92 days, from October 1 to January 1. Build discipline every day, alongside your friends.',
    Scene: WelcomeScene,
  },
  {
    eyebrow: 'Step 1',
    title: 'Set your goals',
    text: 'Pick your own: every day, or a few times a week. Tap Edit on Today to add, change or reorder them.',
    Scene: GoalsScene,
  },
  {
    eyebrow: 'Step 2',
    title: 'Check them off daily',
    text: 'Tap a goal when it’s done. Finished goals move to Done and your streak grows. Forgot last night? You can still log yesterday.',
    Scene: CheckScene,
  },
  {
    eyebrow: 'Friends',
    title: 'Keep each other honest',
    text: 'Add friends by username. See how their day is going and a live feed of everything they check off.',
    Scene: FriendsScene,
  },
  {
    eyebrow: 'Board',
    title: 'Share the grind',
    text: 'Post workouts, wins and photos for your friends. React and comment to keep each other going.',
    Scene: BoardScene,
  },
  {
    eyebrow: 'History',
    title: 'Watch it add up',
    text: 'Your calendar shows every day of the season. Each month, see how you rank against your friends.',
    Scene: HistoryScene,
  },
  {
    eyebrow: 'Stay on track',
    title: 'Get a nudge',
    text: 'Turn on notifications in Account for reminders and your friends’ wins. On iPhone, add Winter Arc to your Home Screen first.',
    Scene: NotifyScene,
  },
]

export default function Intro({ onClose }) {
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState(0)
  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  function goTo(next) {
    if (next >= SLIDES.length) {
      onClose()
      return
    }
    setIndex(Math.max(0, next))
    setStep(0)
  }

  useEffect(() => {
    const ticker = setInterval(() => setStep((current) => current + 1), STEP_MS)
    const advance = isLast ? null : setTimeout(() => goTo(index + 1), SLIDE_MS)
    return () => {
      clearInterval(ticker)
      clearTimeout(advance)
    }
  }, [index])

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'ArrowRight') {
        goTo(index + 1)
      } else if (event.key === 'ArrowLeft') {
        goTo(index - 1)
      }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [index, onClose])

  function handleTap(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    goTo(event.clientX - bounds.left < bounds.width * 0.3 ? index - 1 : index + 1)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Winter Arc"
      className="fixed inset-0 z-40 flex justify-center overflow-hidden bg-black"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_at_top,rgb(132_197_255/0.14),transparent_65%)]" />
      <div className="relative flex w-full max-w-md flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {SLIDES.map((item, position) => (
              <span key={item.title} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                {position < index && <span className="block h-full w-full bg-ice-200" />}
                {position === index && (
                  <span
                    key={index}
                    className={`block h-full w-full origin-left bg-ice-200 ${isLast ? '' : 'animate-intro-progress'}`}
                  />
                )}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-steel-300 transition active:bg-white/5 lg:hover:text-ice-50"
          >
            Skip
          </button>
        </div>

        <div className="flex min-h-0 flex-1 cursor-pointer flex-col" onClick={handleTap}>
          <div key={index} className="flex min-h-0 flex-1 flex-col items-center justify-center py-4 animate-page-in">
            <slide.Scene step={step} />
          </div>
          <div key={`text-${index}`} className="animate-fade-up text-center" aria-live="polite">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ice-300">{slide.eyebrow}</p>
            <h2 className="mt-2 text-[26px] leading-tight font-semibold tracking-tight text-ice-50">{slide.title}</h2>
            <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-steel-300">{slide.text}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          {index > 0 && (
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              className="h-12 rounded-xl border border-white/10 px-5 text-[15px] font-medium text-steel-200 transition active:scale-[0.98] active:bg-white/5"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="h-12 flex-1 rounded-xl bg-ice-50 px-5 text-[15px] font-semibold text-black shadow-[0_0_28px_-8px_rgb(174_219_255/0.6)] transition active:scale-[0.98] active:bg-ice-200"
          >
            {isLast ? 'Start my Winter Arc' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
