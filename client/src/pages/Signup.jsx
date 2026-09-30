import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../AuthContext.jsx'
import AuthCard from '../components/AuthCard.jsx'
import { FormError, PrimaryButton, TextField } from '../components/Form.jsx'
import { deviceTimezone } from '../dates.js'

export default function Signup() {
  const { signup } = useAuth()
  const [fields, setFields] = useState({ username: '', displayName: '', email: '', password: '', inviteCode: '' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const timezone = deviceTimezone()

  function updateField(name, value) {
    setFields({ ...fields, [name]: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (fields.password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await signup({ ...fields, timezone })
    } catch (signupError) {
      setError(signupError.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Create your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Username"
          id="username"
          value={fields.username}
          onChange={(event) => updateField('username', event.target.value.toLowerCase())}
          hint="3-20 characters: letters, numbers or _. Friends find you by this."
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          minLength={3}
          maxLength={20}
          required
        />
        <TextField
          label="Display name"
          id="displayName"
          value={fields.displayName}
          onChange={(event) => updateField('displayName', event.target.value)}
          hint="What friends see in the feed, like “Jake”."
          autoComplete="nickname"
          maxLength={40}
          required
        />
        <TextField
          label="Email"
          id="email"
          type="email"
          value={fields.email}
          onChange={(event) => updateField('email', event.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          required
        />
        <TextField
          label="Password"
          id="password"
          type="password"
          value={fields.password}
          onChange={(event) => updateField('password', event.target.value)}
          hint="At least 8 characters."
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <TextField
          label="Confirm password"
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          maxLength={72}
          required
        />
        <TextField
          label="Invite code"
          id="inviteCode"
          value={fields.inviteCode}
          onChange={(event) => updateField('inviteCode', event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        <p className="text-sm text-steel-400">
          Timezone: <span className="font-medium text-ice-50">{timezone}</span> (from this device, change it later in Settings)
        </p>
        <FormError message={error} />
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-steel-400">
        Already have an account?{' '}
        <Link to="/login" className="inline-block py-3 font-semibold text-ice-300 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
