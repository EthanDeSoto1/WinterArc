const inputClasses =
  'h-12 w-full rounded-xl border border-white/[0.08] bg-ink-900 px-4 text-base text-ice-50 placeholder:text-steel-500 transition focus:border-ice-400/60 focus:outline-none focus:ring-4 focus:ring-ice-400/10'

export function TextField({ label, id, hint, ...inputProps }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-steel-300">
        {label}
      </label>
      <input id={id} className={inputClasses} {...inputProps} />
      {hint && <p className="text-xs text-steel-500">{hint}</p>}
    </div>
  )
}

export function SelectField({ label, id, hint, children, ...selectProps }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-steel-300">
        {label}
      </label>
      <select id={id} className={inputClasses} {...selectProps}>
        {children}
      </select>
      {hint && <p className="text-xs text-steel-500">{hint}</p>}
    </div>
  )
}

export function PrimaryButton({ children, className = '', ...buttonProps }) {
  return (
    <button
      className={`h-12 rounded-xl bg-ice-50 px-5 text-[15px] font-semibold text-black shadow-[0_0_28px_-8px_rgb(174_219_255/0.6)] transition active:scale-[0.98] active:bg-ice-200 disabled:opacity-40 disabled:shadow-none ${className}`}
      {...buttonProps}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className = '', ...buttonProps }) {
  return (
    <button
      className={`h-12 rounded-xl border border-white/10 px-5 text-[15px] font-medium text-steel-200 transition active:scale-[0.98] active:bg-white/5 disabled:opacity-40 ${className}`}
      {...buttonProps}
    >
      {children}
    </button>
  )
}

export function FormError({ message }) {
  if (!message) {
    return null
  }
  return (
    <p className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200" role="alert">
      {message}
    </p>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-white/[0.06] bg-ink-900 p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition ${
              selected ? 'bg-ink-700 text-ice-50 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]' : 'text-steel-500 active:text-steel-300'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
