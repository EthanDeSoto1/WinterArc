import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { FlameIcon } from './Icons.jsx'
import { formatMonthName } from '../dates.js'

const SLIDE_MS = 6500

function placeText(place) {
  if (place % 100 >= 11 && place % 100 <= 13) {
    return `${place}th`
  }
  return `${place}${{ 1: 'st', 2: 'nd', 3: 'rd' }[place % 10] || 'th'}`
}

function BigNumber({ value, label }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full border border-dashed border-ice-300/20" />
      <div className="absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 animate-spin-reverse rounded-full border border-dotted border-ice-300/25" />
      <p className="relative animate-rise-in bg-gradient-to-b from-white via-ice-100 to-ice-400/70 bg-clip-text text-[96px] leading-[0.9] font-bold tracking-[-0.06em] text-transparent tabular-nums drop-shadow-[0_0_32px_rgb(132_197_255/0.25)]">
        {value}
      </p>
      {label && <p className="relative mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-400">{label}</p>}
    </div>
  )
}

function StatGrid({ items }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2.5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className="animate-rise-in rounded-2xl border border-white/[0.06] bg-ink-900/80 px-3 py-5 text-center"
          style={{ animationDelay: `${index * 200}ms` }}
        >
          <p className="text-4xl font-bold text-ice-50 tabular-nums">{item.value}</p>
          <p className="mt-1 text-xs font-medium text-steel-400">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

function buildSlides(stats) {
  const slides = [
    {
      eyebrow: 'Season wrap-up',
      title: 'Your Winter Arc is done',
      text: '92 days, October 1 to December 31. Here’s what you built.',
      scene: <img src="/icon.svg" alt="" className="size-24 animate-check-pop rounded-3xl shadow-[0_0_48px_-6px_rgb(132_197_255/0.7)]" />,
    },
    {
      eyebrow: 'Check-offs',
      title: `${stats.checkoffs} ${stats.checkoffs === 1 ? 'goal' : 'goals'} checked off`,
      text:
        stats.percent === null
          ? 'Every single one counted.'
          : `You finished ${stats.percent}% of your daily goals this season.`,
      scene: <BigNumber value={stats.checkoffs} label="check-offs" />,
    },
  ]
  if (stats.percent !== null) {
    slides.push({
      eyebrow: 'Full days',
      title: `${stats.fullDays} ${stats.fullDays === 1 ? 'day' : 'days'} with everything done`,
      text: 'Days where every daily goal got checked off.',
      scene: <BigNumber value={stats.fullDays} label="full days" />,
    })
  }
  if (stats.bestStreak.days > 0) {
    slides.push({
      eyebrow: 'Best streak',
      title: `${stats.bestStreak.days} days in a row`,
      text: `Your longest run: ${stats.bestStreak.goal}.`,
      scene: (
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-20 animate-check-pop items-center justify-center rounded-full bg-ice-100 text-black shadow-[0_0_40px_rgb(174_219_255/0.6)]">
            <FlameIcon className="size-10" strokeWidth={2} />
          </span>
          <BigNumber value={stats.bestStreak.days} label="day streak" />
        </div>
      ),
    })
  }
  if (stats.bestMonth) {
    slides.push({
      eyebrow: 'Best month',
      title: `${formatMonthName(`${stats.bestMonth.month}-01`)} was your month`,
      text: `${stats.bestMonth.percent}% of your daily goals done.`,
      scene: <BigNumber value={`${stats.bestMonth.percent}%`} label={formatMonthName(`${stats.bestMonth.month}-01`)} />,
    })
  }
  if (stats.rank) {
    slides.push({
      eyebrow: 'With friends',
      title: `${placeText(stats.rank.place)} of ${stats.rank.of}`,
      text: 'Ranked by daily goals finished across the whole season.',
      scene: <BigNumber value={placeText(stats.rank.place)} label={`of ${stats.rank.of}`} />,
    })
  }
  slides.push({
    eyebrow: 'Together',
    title: 'You kept each other going',
    text: 'Board posts, reactions and cheers this season, plus the streak badges you earned.',
    scene: (
      <StatGrid
        items={[
          { value: stats.posts, label: stats.posts === 1 ? 'Post' : 'Posts' },
          { value: stats.reactions, label: 'Reactions received' },
          { value: stats.cheers, label: 'Cheers received' },
          { value: stats.milestones, label: stats.milestones === 1 ? 'Badge' : 'Badges' },
        ]}
      />
    ),
  })
  slides.push({
    eyebrow: 'See you next winter',
    title: 'Keep the arc going',
    text: 'The habits are yours now. Your history stays here whenever you want to look back.',
    scene: <BigNumber value={stats.season.start.slice(0, 4)} label="Winter Arc" />,
  })
  return slides
}

export default function Wrapped({ onClose }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const slides = stats ? buildSlides(stats) : []
  const slide = slides[index]
  const isLast = index === slides.length - 1

  useEffect(() => {
    api('/wrapped')
      .then(setStats)
      .catch((loadError) => setError(loadError.message))
  }, [])

  function goTo(next) {
    if (next >= slides.length) {
      onClose()
      return
    }
    setIndex(Math.max(0, next))
  }

  useEffect(() => {
    if (!stats || isLast) {
      return
    }
    const advance = setTimeout(() => goTo(index + 1), SLIDE_MS)
    return () => clearTimeout(advance)
  }, [index, stats])

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'ArrowRight' && stats) {
        goTo(index + 1)
      } else if (event.key === 'ArrowLeft' && stats) {
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
  }, [index, stats, onClose])

  function handleTap(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    goTo(event.clientX - bounds.left < bounds.width * 0.3 ? index - 1 : index + 1)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Your season wrap-up" className="fixed inset-0 z-40 flex justify-center overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_at_top,rgb(132_197_255/0.14),transparent_65%)]" />
      <div className="relative flex w-full max-w-md flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {slides.map((item, position) => (
              <span key={item.eyebrow} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                {position < index && <span className="block h-full w-full bg-ice-200" />}
                {position === index && (
                  <span key={index} className={`block h-full w-full origin-left bg-ice-200 ${isLast ? '' : 'animate-intro-progress'}`} />
                )}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-steel-300 transition active:bg-white/5 lg:hover:text-ice-50"
          >
            {stats ? 'Skip' : 'Close'}
          </button>
        </div>

        {!stats && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-steel-400" role="status">
            {error ? (
              <p className="text-rose-200">{error}</p>
            ) : (
              <>
                <div className="size-6 animate-spin rounded-full border-2 border-white/10 border-t-ice-300" />
                Adding up your season…
              </>
            )}
          </div>
        )}

        {stats && (
          <div className="flex min-h-0 flex-1 cursor-pointer flex-col" onClick={handleTap}>
            <div key={index} className="flex min-h-0 flex-1 flex-col items-center justify-center py-4 animate-page-in">
              {slide.scene}
            </div>
            <div key={`text-${index}`} className="animate-fade-up text-center" aria-live="polite">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ice-300">{slide.eyebrow}</p>
              <h2 className="mt-2 text-[26px] leading-tight font-semibold tracking-tight text-ice-50">{slide.title}</h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-steel-300">{slide.text}</p>
            </div>
          </div>
        )}

        {stats && (
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
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
