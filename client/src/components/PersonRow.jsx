export function SectionTitle({ children }) {
  return <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500">{children}</h2>
}

export const AVATAR_COLORS = [
  { key: 'frost', label: 'Frost', rgb: '125 211 252', text: '#e0f2fe' },
  { key: 'glacier', label: 'Glacier', rgb: '96 165 250', text: '#dbeafe' },
  { key: 'arctic', label: 'Arctic', rgb: '45 212 191', text: '#ccfbf1' },
  { key: 'aurora', label: 'Aurora', rgb: '110 231 183', text: '#d1fae5' },
  { key: 'nebula', label: 'Nebula', rgb: '167 139 250', text: '#ede9fe' },
  { key: 'ember', label: 'Ember', rgb: '251 113 133', text: '#ffe4e6' },
  { key: 'solstice', label: 'Solstice', rgb: '252 211 77', text: '#fef3c7' },
  { key: 'steel', label: 'Steel', rgb: '148 163 184', text: '#e2e8f0' },
]

export function avatarStyle(colorKey) {
  const color = AVATAR_COLORS.find((item) => item.key === colorKey) || AVATAR_COLORS[0]
  return {
    background: `radial-gradient(circle at 30% 25%, rgb(${color.rgb} / 0.34), rgb(${color.rgb} / 0.1) 55%, rgb(10 12 16) 100%)`,
    borderColor: `rgb(${color.rgb} / 0.45)`,
    color: color.text,
    boxShadow: `0 0 18px -6px rgb(${color.rgb} / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.08)`,
  }
}

const AVATAR_SIZES = {
  small: 'size-6 text-[11px]',
  normal: 'size-10 text-[15px]',
  large: 'size-16 text-2xl',
}

export function Avatar({ user, large = false, small = false, className = '' }) {
  const initial = Array.from(user.displayName)[0] || '?'
  const size = large ? 'large' : small ? 'small' : 'normal'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border font-semibold transition-all duration-300 ${AVATAR_SIZES[size]} ${className}`}
      style={avatarStyle(user.avatarColor)}
      aria-hidden="true"
    >
      {initial.toUpperCase()}
    </div>
  )
}

export default function PersonRow({ user, children }) {
  return (
    <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-white/[0.06] bg-ink-900/70 py-2 pr-2 pl-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ice-50">{user.displayName}</p>
        <p className="truncate text-xs text-steel-500">@{user.username}</p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  )
}
