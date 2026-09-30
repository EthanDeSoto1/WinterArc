import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { currentSubscription, isIphoneBrowserTab, pushSupported, turnOffPush, turnOnPush } from '../push.js'
import { SectionTitle } from './PersonRow.jsx'
import { FormError, SmallButton } from './Form.jsx'
import { ErrorState, LoadingState, Toast } from './States.jsx'

const GROUPS = [
  {
    title: 'Board',
    switches: [
      { key: 'posts', label: 'New posts on the Board' },
      { key: 'myPosts', label: 'Reactions and comments on my posts' },
    ],
  },
  {
    title: 'Friends',
    switches: [
      { key: 'friendDone', label: 'A friend finishes all of today’s goals' },
      { key: 'friendGoals', label: 'Every goal a friend checks off' },
      { key: 'friendRequests', label: 'Friend requests' },
    ],
  },
]

const REMINDERS = [
  { key: 'remindMorning', hourKey: 'remindMorningHour', label: 'Morning', earliest: 5, latest: 10 },
  { key: 'remindMidday', hourKey: 'remindMiddayHour', label: 'Midday', earliest: 11, latest: 16 },
  { key: 'remindEvening', hourKey: 'remindEveningHour', label: 'Evening', earliest: 17, latest: 23 },
]

function formatHour(hour) {
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`
}

function hoursBetween(earliest, latest) {
  const hours = []
  for (let hour = earliest; hour <= latest; hour++) {
    hours.push(hour)
  }
  return hours
}

const cardClasses = 'rounded-2xl border border-white/[0.06] bg-ink-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]'

function Switch({ label, on, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-13 w-full items-center justify-between gap-4 px-5 py-2 text-left text-[15px] text-steel-200 transition active:bg-white/[0.03]"
    >
      <span>{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
          on ? 'border-ice-300/50 bg-ice-300/80 shadow-[0_0_16px_-4px_rgb(174_219_255/0.7)]' : 'border-white/10 bg-ink-800'
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 left-0.5 size-[1.375rem] rounded-full transition-transform ${
            on ? 'translate-x-5 bg-black' : 'bg-steel-400'
          }`}
        />
      </span>
    </button>
  )
}

function ReminderRow({ reminder, settings, onToggle, onHourChange }) {
  const on = settings[reminder.key]
  const hour = settings[reminder.hourKey]
  const selectId = `reminder-${reminder.key}`
  return (
    <div>
      <Switch label={`${reminder.label} · ${formatHour(hour)}`} on={on} onToggle={onToggle} />
      {on && (
        <div className="flex items-center justify-between gap-4 px-5 pb-3">
          <label htmlFor={selectId} className="text-sm text-steel-400">
            Time
          </label>
          <select
            id={selectId}
            value={hour}
            onChange={(event) => onHourChange(Number(event.target.value))}
            className="h-11 rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-base text-ice-50 transition focus:border-ice-400/60 focus:outline-none focus:ring-4 focus:ring-ice-400/10 lg:text-sm"
          >
            {hoursBetween(reminder.earliest, reminder.latest).map((value) => (
              <option key={value} value={value}>
                {formatHour(value)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function DeviceMessage({ children }) {
  return <p className="px-5 py-4 text-sm text-steel-400">{children}</p>
}

export default function NotificationSettings() {
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [publicKey, setPublicKey] = useState(null)
  const [settings, setSettings] = useState({})
  const [deviceOn, setDeviceOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deviceError, setDeviceError] = useState('')
  const [notice, setNotice] = useState('')
  const [toast, setToast] = useState('')

  function load() {
    setStatus('loading')
    Promise.all([api('/push'), currentSubscription()])
      .then(([result, subscription]) => {
        setPublicKey(result.publicKey)
        setSettings(result.settings)
        setDeviceOn(subscription !== null && Notification.permission === 'granted')
        setStatus('ready')
      })
      .catch((error) => {
        setLoadError(error.message)
        setStatus('error')
      })
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  async function changeDevice(turnOn) {
    setBusy(true)
    setDeviceError('')
    setNotice('')
    try {
      if (turnOn) {
        await turnOnPush(publicKey)
      } else {
        await turnOffPush()
      }
      setDeviceOn(turnOn)
    } catch (error) {
      setDeviceError(error.message)
    }
    setBusy(false)
  }

  async function sendTest() {
    setBusy(true)
    setDeviceError('')
    setNotice('')
    try {
      await api('/push/test', { method: 'POST' })
      setNotice('Sent. It should arrive in a few seconds.')
    } catch (error) {
      setDeviceError(error.message)
    }
    setBusy(false)
  }

  async function save(key, next) {
    const previous = settings
    setSettings({ ...settings, [key]: next })
    try {
      const result = await api('/push/settings', { method: 'PATCH', body: { [key]: next } })
      setSettings(result.settings)
    } catch (error) {
      setSettings(previous)
      setToast(error.message)
    }
  }

  function deviceArea() {
    if (!pushSupported()) {
      return isIphoneBrowserTab() ? (
        <DeviceMessage>
          To get notifications on iPhone, add Winter Arc to your Home Screen (Share → Add to Home Screen) and open it from there.
        </DeviceMessage>
      ) : (
        <DeviceMessage>This browser can’t show notifications.</DeviceMessage>
      )
    }
    if (!publicKey) {
      return <DeviceMessage>Notifications aren’t set up on the server yet.</DeviceMessage>
    }
    if (Notification.permission === 'denied') {
      return <DeviceMessage>Notifications are blocked for Winter Arc. Allow them in your device settings, then come back here.</DeviceMessage>
    }
    return (
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-ice-50">This device</p>
            <p className={`text-sm ${deviceOn ? 'text-ice-300' : 'text-steel-500'}`}>{deviceOn ? 'Notifications on' : 'Notifications off'}</p>
          </div>
          <SmallButton primary={!deviceOn} disabled={busy} onClick={() => changeDevice(!deviceOn)}>
            {deviceOn ? 'Turn off' : 'Turn on'}
          </SmallButton>
        </div>
        {deviceOn && (
          <SmallButton className="self-start" disabled={busy} onClick={sendTest}>
            Send a test
          </SmallButton>
        )}
        <FormError message={deviceError} />
        {notice && (
          <p className="text-sm font-medium text-ice-300" role="status">
            {notice}
          </p>
        )}
      </div>
    )
  }

  return (
    <section className="mt-8">
      <SectionTitle>Notifications</SectionTitle>
      {status === 'loading' && <LoadingState message="Loading notifications…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={load} />}
      {status === 'ready' && (
        <div className="flex flex-col gap-4">
          <div className={cardClasses}>{deviceArea()}</div>
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-1 text-[13px] font-medium text-steel-400">{group.title}</p>
              <div className={`${cardClasses} divide-y divide-white/[0.05] overflow-hidden`}>
                {group.switches.map((item) => (
                  <Switch key={item.key} label={item.label} on={settings[item.key]} onToggle={() => save(item.key, !settings[item.key])} />
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 px-1 text-[13px] font-medium text-steel-400">Reminders</p>
            <div className={`${cardClasses} divide-y divide-white/[0.05] overflow-hidden`}>
              {REMINDERS.map((reminder) => (
                <ReminderRow
                  key={reminder.key}
                  reminder={reminder}
                  settings={settings}
                  onToggle={() => save(reminder.key, !settings[reminder.key])}
                  onHourChange={(hour) => save(reminder.hourKey, hour)}
                />
              ))}
            </div>
            <p className="mt-2 px-1 text-xs text-steel-500">In your profile’s timezone. Skipped when all of today’s goals are done.</p>
          </div>
          <p className="px-1 text-xs text-steel-500">These choices apply to every device where notifications are on.</p>
        </div>
      )}
      <Toast message={toast} />
    </section>
  )
}
