import { MoonIcon } from './Icons.jsx'
import { daysUntilNewYear } from '../dates.js'

export default function AuthCard({ title, children }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="relative mb-6 flex size-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-ice-300/20 blur-2xl" />
          <div className="relative flex size-16 items-center justify-center rounded-full border border-white/10 bg-ink-900 text-ice-100 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
            <MoonIcon className="size-7" />
          </div>
        </div>
        <p className="text-[26px] font-bold uppercase tracking-[0.32em] text-ice-50">Winter Arc</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-steel-500">
          {daysUntilNewYear()} days until Jan 1
        </p>
      </div>
      <h1 className="mb-5 text-xl font-semibold tracking-tight text-ice-50">{title}</h1>
      {children}
    </main>
  )
}
