import { useEffect } from 'react'
import { FlameIcon } from './Icons.jsx'

export function milestoneLabel(streak, frequency) {
  return frequency === 'daily' ? `${streak}-day streak` : `${streak}-week streak`
}

export function MilestoneBadge({ streak, frequency }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ice-300/25 bg-ice-300/[0.08] px-2 py-0.5 text-[11px] font-semibold text-ice-200">
      <FlameIcon className="size-3" strokeWidth={2.2} />
      {milestoneLabel(streak, frequency)}
    </span>
  )
}

export default function MilestoneCelebration({ celebration, onClose }) {
  useEffect(() => {
    if (!celebration) {
      return
    }
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [celebration])

  if (!celebration) {
    return null
  }

  return (
    <div className="fixed inset-x-0 top-[calc(1rem+env(safe-area-inset-top))] z-30 flex justify-center px-4" role="status" aria-live="polite">
      <button
        type="button"
        onClick={onClose}
        className="flex w-full max-w-sm animate-fade-up items-center gap-4 rounded-2xl border border-ice-300/30 bg-ink-800/95 px-4 py-3.5 text-left shadow-[0_0_48px_-12px_rgb(132_197_255/0.7)] backdrop-blur"
      >
        <span className="flex size-12 shrink-0 animate-check-pop items-center justify-center rounded-full bg-ice-100 text-black shadow-[0_0_24px_rgb(174_219_255/0.6)]">
          <FlameIcon className="size-6" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold text-ice-50">{milestoneLabel(celebration.streak, celebration.frequency)}!</span>
          <span className="mt-0.5 block truncate text-sm text-steel-300">{celebration.title}</span>
          <span className="mt-0.5 block text-xs text-steel-500">Your friends will see the badge.</span>
        </span>
      </button>
    </div>
  )
}
