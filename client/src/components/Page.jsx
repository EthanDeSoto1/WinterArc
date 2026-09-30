export default function Page({ eyebrow, title, action, children }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500">{eyebrow}</p>
          )}
          <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-ice-50">{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </main>
  )
}
