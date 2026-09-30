import { useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import { AVATAR_COLORS, Avatar, SectionTitle, avatarStyle } from './PersonRow.jsx'
import { FormError } from './Form.jsx'

export default function AvatarColorPicker() {
  const { user, setUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const current = AVATAR_COLORS.find((color) => color.key === user.avatarColor) || AVATAR_COLORS[0]

  async function chooseColor(colorKey) {
    if (saving || colorKey === user.avatarColor) {
      return
    }
    const previousUser = user
    setError('')
    setSaving(true)
    setUser({ ...user, avatarColor: colorKey })
    try {
      const data = await api('/me', { method: 'PATCH', body: { avatarColor: colorKey } })
      setUser(data.user)
    } catch (saveError) {
      setUser(previousUser)
      setError(saveError.message)
    }
    setSaving(false)
  }

  return (
    <section className="mt-8">
      <SectionTitle>Icon color</SectionTitle>
      <div className="rounded-2xl border border-white/[0.06] bg-ink-900/70 p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
        <div className="mb-5 flex items-center gap-4">
          <Avatar user={user} large />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-ice-50">{user.displayName}</p>
            <p className="text-xs text-steel-500">{current.label} · friends see this color</p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Icon color" className="grid grid-cols-4 gap-x-2 gap-y-3">
          {AVATAR_COLORS.map((color) => {
            const selected = color.key === current.key
            return (
              <button
                key={color.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseColor(color.key)}
                className="flex min-h-11 flex-col items-center gap-1.5 rounded-xl py-1 transition active:scale-95"
              >
                <span
                  className={`flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-ink-900 transition ${
                    selected ? 'ring-2 ring-ice-100/80' : ''
                  }`}
                >
                  <span className="size-10 rounded-full border" style={avatarStyle(color.key)} />
                </span>
                <span className={`text-[11px] font-medium ${selected ? 'text-ice-100' : 'text-steel-500'}`}>{color.label}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 empty:hidden">
          <FormError message={error} />
        </div>
      </div>
    </section>
  )
}
