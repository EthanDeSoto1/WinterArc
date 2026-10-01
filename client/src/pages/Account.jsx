import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import Page from '../components/Page.jsx'
import ManageFriends from '../components/ManageFriends.jsx'
import AvatarColorPicker from '../components/AvatarColorPicker.jsx'
import ChangePassword from '../components/ChangePassword.jsx'
import NotificationSettings from '../components/NotificationSettings.jsx'
import AdminPanel from '../components/AdminPanel.jsx'
import { FormError, PrimaryButton, SelectField, TextField } from '../components/Form.jsx'
import { deviceTimezone } from '../dates.js'
import { turnOffPush } from '../push.js'

function timezoneOptions(current) {
  const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []
  return zones.includes(current) ? zones : [current, ...zones]
}

export default function Account() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [timezone, setTimezone] = useState(user.timezone)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const thisDevice = deviceTimezone()
  const changed = displayName !== user.displayName || timezone !== user.timezone

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const data = await api('/me', { method: 'PATCH', body: { displayName, timezone } })
      setUser(data.user)
      setDisplayName(data.user.displayName)
      setSaved(true)
    } catch (saveError) {
      setError(saveError.message)
    }
    setSaving(false)
  }

  async function handleLogout() {
    setLogoutError('')
    setLoggingOut(true)
    try {
      await turnOffPush().catch(() => {})
      await logout()
      navigate('/login', { replace: true })
    } catch (logoutFailure) {
      setLogoutError(logoutFailure.message)
      setLoggingOut(false)
    }
  }

  return (
    <Page
      eyebrow={`@${user.username}`}
      title="Account"
      action={
        <Link
          to={`/people/${user.id}`}
          className="flex min-h-11 shrink-0 items-center rounded-full border border-white/10 px-4 text-sm font-medium text-steel-200 transition active:bg-white/5 lg:hover:border-ice-300/30 lg:hover:text-ice-50"
        >
          My profile
        </Link>
      }
    >
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-5 rounded-2xl border border-white/[0.06] bg-ink-900/70 p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
      >
        <TextField
          label="Display name"
          id="displayName"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value)
            setSaved(false)
          }}
          maxLength={40}
          required
        />
        <div className="flex flex-col gap-2">
          <SelectField
            label="Timezone"
            id="timezone"
            value={timezone}
            hint="Decides when your day starts and ends."
            onChange={(event) => {
              setTimezone(event.target.value)
              setSaved(false)
            }}
          >
            {timezoneOptions(timezone).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </SelectField>
          {timezone !== thisDevice && (
            <button
              type="button"
              onClick={() => {
                setTimezone(thisDevice)
                setSaved(false)
              }}
              className="min-h-11 self-start text-sm font-semibold text-ice-300"
            >
              Use this device’s timezone ({thisDevice.replaceAll('_', ' ')})
            </button>
          )}
        </div>
        <FormError message={error} />
        {saved && !changed && (
          <p className="text-sm font-medium text-ice-300" role="status">
            Saved
          </p>
        )}
        <PrimaryButton type="submit" disabled={saving || !changed}>
          {saving ? 'Saving…' : 'Save changes'}
        </PrimaryButton>
      </form>

      <AvatarColorPicker />

      <NotificationSettings />

      <ChangePassword />

      <ManageFriends />

      {user.isAdmin && <AdminPanel />}

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('winterarc:intro'))}
        className="mt-8 h-12 w-full rounded-xl border border-white/10 text-[15px] font-medium text-steel-200 transition active:scale-[0.98] active:bg-white/5"
      >
        Watch the intro
      </button>

      <p className="mt-8 px-1 text-sm text-steel-500">Signed in as {user.email}</p>

      <div className="mt-4 flex flex-col gap-3">
        <FormError message={logoutError} />
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="h-12 w-full rounded-xl border border-rose-400/25 text-[15px] font-semibold text-rose-300 transition active:bg-rose-500/10 disabled:opacity-40"
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </Page>
  )
}
