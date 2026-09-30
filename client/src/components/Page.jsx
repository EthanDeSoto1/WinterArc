export default function Page({ eyebrow, title, action, wide = false, children }) {
  return (
    <main
      className={`mx-auto w-full max-w-md px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 lg:px-10 lg:pt-12 lg:pb-16 ${
        wide ? 'lg:max-w-6xl' : 'lg:max-w-2xl'
      }`}
    >
      <header className="relative mb-6 flex items-end justify-between gap-4 lg:mb-10 lg:pb-5">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500 lg:mb-2">{eyebrow}</p>
          )}
          <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-ice-50 lg:text-[36px]">{title}</h1>
        </div>
        {action}
        <span
          className="absolute inset-x-0 bottom-0 hidden h-px bg-gradient-to-r from-ice-300/40 via-white/[0.06] to-transparent lg:block"
          aria-hidden="true"
        />
      </header>
      {children}
    </main>
  )
}
