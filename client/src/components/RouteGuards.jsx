import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../AuthContext.jsx'
import { ErrorState, LoadingState } from './States.jsx'

function FullScreen({ children }) {
  return <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">{children}</div>
}

function AuthStatusScreen() {
  const { status, loadUser } = useAuth()
  if (status === 'loading') {
    return (
      <FullScreen>
        <LoadingState />
      </FullScreen>
    )
  }
  return (
    <FullScreen>
      <ErrorState message="Could not reach Winter Arc. Check your connection." onRetry={loadUser} />
    </FullScreen>
  )
}

export function RequireAuth() {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status !== 'ready') {
    return <AuthStatusScreen />
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function PublicOnly() {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') {
    return <AuthStatusScreen />
  }
  if (user) {
    const destination = (location.state && location.state.from) || '/'
    return <Navigate to={destination} replace />
  }
  return <Outlet />
}
