import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../AuthContext.jsx'
import AuthCard from '../components/AuthCard.jsx'
import { FormError, PrimaryButton, TextField } from '../components/Form.jsx'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
    } catch (loginError) {
      setError(loginError.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Log in">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Username"
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          required
        />
        <TextField
          label="Password"
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <FormError message={error} />
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-steel-400">
        New here?{' '}
        <Link to="/signup" className="inline-block py-3 font-semibold text-ice-300 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  )
}
