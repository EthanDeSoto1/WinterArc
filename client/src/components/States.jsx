export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-steel-500 lg:animate-[fade-up_260ms_200ms_ease-out_both]" role="status">
      <div className="size-7 animate-spin rounded-full border-2 border-white/10 border-t-ice-300" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] px-5 py-8 text-center" role="alert">
      <p className="text-rose-200">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-xl border border-rose-400/30 px-5 text-sm font-semibold text-rose-100 active:bg-rose-500/10"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, message, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <p className="text-lg font-semibold text-ice-50">{title}</p>
      {message && <p className="max-w-xs text-sm text-steel-400">{message}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function Toast({ message }) {
  if (!message) {
    return null
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
      <p
        className="animate-fade-up rounded-full border border-rose-400/20 bg-ink-800/95 px-4 py-2.5 text-sm text-rose-100 shadow-2xl backdrop-blur"
        role="alert"
      >
        {message}
      </p>
    </div>
  )
}
