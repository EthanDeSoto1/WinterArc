export function SectionTitle({ children }) {
  return <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500">{children}</h2>
}

export default function PersonRow({ user, children }) {
  const initial = Array.from(user.displayName)[0] || '?'
  return (
    <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-white/[0.06] bg-ink-900/70 py-2 pr-2 pl-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-ink-700 text-[15px] font-semibold text-ice-100"
        aria-hidden="true"
      >
        {initial.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ice-50">{user.displayName}</p>
        <p className="truncate text-xs text-steel-500">@{user.username}</p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  )
}
