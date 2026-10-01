import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Avatar, SectionTitle } from './PersonRow.jsx'
import { FormError, SmallButton, TextField } from './Form.jsx'
import { ErrorState, LoadingState } from './States.jsx'
import { formatShortDate } from '../dates.js'

const cardClasses = 'rounded-2xl border border-white/[0.06] bg-ink-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]'

function lastSeenText(user) {
  if (!user.lastCheckoff) {
    return 'No check-offs yet'
  }
  return `Last check-off ${formatShortDate(user.lastCheckoff.slice(0, 10))}`
}

function InviteCode() {
  const [saved, setSaved] = useState(null)
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api('/admin/invite')
      .then((result) => {
        setSaved(result.inviteCode)
        setCode(result.inviteCode)
      })
      .catch((loadError) => setError(loadError.message))
  }, [])

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await api('/admin/invite', { method: 'PUT', body: { inviteCode: code } })
      setSaved(result.inviteCode)
      setCode(result.inviteCode)
      setMessage('Invite code saved. The old one stops working now.')
    } catch (saveError) {
      setError(saveError.message)
    }
    setSaving(false)
  }

  return (
    <form onSubmit={save} className={`${cardClasses} flex flex-col gap-3 p-4`}>
      <TextField
        label="Invite code"
        id="admin-invite"
        value={code}
        onChange={(event) => {
          setCode(event.target.value)
          setMessage('')
        }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={64}
        hint="New people need this code to sign up."
      />
      <FormError message={error} />
      {message && (
        <p className="text-sm font-medium text-ice-300" role="status">
          {message}
        </p>
      )}
      <SmallButton type="submit" primary disabled={saving || saved === null || code.trim() === saved} className="self-start">
        {saving ? 'Saving…' : 'Save invite code'}
      </SmallButton>
    </form>
  )
}

function UserRow({ user, onReset, resetting }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ice-50">
          {user.displayName}
          {user.isYou && <span className="text-steel-500"> (you)</span>}
        </p>
        <p className="truncate text-xs text-steel-500">
          @{user.username} · {user.activeGoals} {user.activeGoals === 1 ? 'goal' : 'goals'}
        </p>
        <p className="truncate text-xs text-steel-500">{lastSeenText(user)}</p>
      </div>
      {!user.isYou && (
        <SmallButton onClick={() => onReset(user)} disabled={resetting} className="shrink-0 px-3">
          {resetting ? 'Resetting…' : 'Reset password'}
        </SmallButton>
      )}
    </li>
  )
}

export default function AdminPanel() {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [resettingId, setResettingId] = useState(null)
  const [resetError, setResetError] = useState('')
  const [temporary, setTemporary] = useState(null)
  const [copied, setCopied] = useState(false)

  function load() {
    setStatus('loading')
    api('/admin/users')
      .then((result) => {
        setUsers(result.users)
        setStatus('ready')
      })
      .catch((error) => {
        setLoadError(error.message)
        setStatus('error')
      })
  }

  useEffect(load, [])

  async function resetPassword(user) {
    if (!window.confirm(`Reset @${user.username}’s password? They’ll be signed out everywhere and their notifications turn off.`)) {
      return
    }
    setResettingId(user.id)
    setResetError('')
    setTemporary(null)
    setCopied(false)
    try {
      setTemporary(await api(`/admin/users/${user.id}/password`, { method: 'POST' }))
    } catch (error) {
      setResetError(error.message)
    }
    setResettingId(null)
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(temporary.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mt-8">
      <SectionTitle>Admin</SectionTitle>
      <div className="flex flex-col gap-4">
        <InviteCode />
        {status === 'loading' && <LoadingState message="Loading people…" />}
        {status === 'error' && <ErrorState message={loadError} onRetry={load} />}
        {status === 'ready' && (
          <div>
            <p className="mb-2 px-1 text-[13px] font-medium text-steel-400">
              {users.length} {users.length === 1 ? 'person' : 'people'} on Winter Arc
            </p>
            <FormError message={resetError} />
            {temporary && (
              <div className="mb-3 rounded-2xl border border-ice-300/25 bg-ice-300/[0.06] p-4" role="status">
                <p className="text-sm text-steel-200">
                  Temporary password for <span className="font-semibold text-ice-50">@{temporary.username}</span>. Send it to them privately;
                  they can change it in Account.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-950 px-3 py-2.5 font-mono text-base text-ice-50 select-all">
                    {temporary.password}
                  </code>
                  <SmallButton onClick={copyPassword} className="shrink-0">
                    {copied ? 'Copied' : 'Copy'}
                  </SmallButton>
                </div>
              </div>
            )}
            <ul className={`${cardClasses} divide-y divide-white/[0.05] overflow-hidden`}>
              {users.map((user) => (
                <UserRow key={user.id} user={user} onReset={resetPassword} resetting={resettingId === user.id} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
