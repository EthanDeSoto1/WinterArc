import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  function loadUser() {
    setStatus('loading')
    api('/me')
      .then((data) => {
        setUser(data.user)
        setStatus('ready')
      })
      .catch((error) => {
        setUser(null)
        setStatus(error.status === 401 ? 'ready' : 'error')
      })
  }

  useEffect(() => {
    loadUser()
    function handleLoggedOut() {
      setUser(null)
    }
    window.addEventListener('winterarc:logged-out', handleLoggedOut)
    return () => window.removeEventListener('winterarc:logged-out', handleLoggedOut)
  }, [])

  async function login(username, password) {
    const data = await api('/login', { method: 'POST', body: { username, password } })
    setUser(data.user)
  }

  async function signup(fields) {
    const data = await api('/signup', { method: 'POST', body: fields })
    setUser(data.user)
  }

  async function logout() {
    await api('/logout', { method: 'POST' })
    setUser(null)
  }

  const value = { user, status, loadUser, login, signup, logout, setUser }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
