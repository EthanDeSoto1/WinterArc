import { useState } from 'react'
import { api } from '../api.js'
import { syncPush } from '../push.js'
import { useAuth } from '../AuthContext.jsx'
import { SectionTitle } from './PersonRow.jsx'
import { FormError, PrimaryButton, TextField } from './Form.jsx'

function signedOutMessage(count) {
  if (count === 0) {
    return 'Password changed.'
  }
  return `Password changed. ${count} other ${count === 1 ? 'device was' : 'devices were'} signed out.`
}

export default function ChangePassword() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mismatch = confirmPassword !== '' && confirmPassword !== newPassword
  const ready = currentPassword !== '' && newPassword.length >= 8 && confirmPassword === newPassword

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    clearMessages()
    setSaving(true)
    try {
      const result = await api('/me/password', { method: 'POST', body: { currentPassword, newPassword } })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(signedOutMessage(result.signedOut))
      syncPush().catch(() => {})
    } catch (saveError) {
      setError(saveError.message)
    }
    setSaving(false)
  }

  return (
    <section className="mt-8">
      <SectionTitle>Password</SectionTitle>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-white/[0.06] bg-ink-900/70 p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
      >
        <input type="text" name="username" autoComplete="username" value={user.username} readOnly hidden />
        <TextField
          label="Current password"
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value)
            clearMessages()
          }}
          maxLength={200}
        />
        <TextField
          label="New password"
          id="newPassword"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters. Other devices will be signed out."
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value)
            clearMessages()
          }}
          maxLength={72}
        />
        <div className="flex flex-col gap-2">
          <TextField
            label="Confirm new password"
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              clearMessages()
            }}
            maxLength={72}
            aria-invalid={mismatch}
          />
          {mismatch && <p className="text-xs text-rose-200">Passwords don’t match</p>}
        </div>
        <FormError message={error} />
        {success && (
          <p className="text-sm font-medium text-ice-300" role="status">
            {success}
          </p>
        )}
        <PrimaryButton type="submit" disabled={saving || !ready}>
          {saving ? 'Changing…' : 'Change password'}
        </PrimaryButton>
      </form>
    </section>
  )
}
