import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './AuthContext.jsx'
import Layout from './components/Layout.jsx'
import { PublicOnly, RequireAuth } from './components/RouteGuards.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Today from './pages/Today.jsx'
import Friends from './pages/Friends.jsx'
import AddFriend from './pages/AddFriend.jsx'
import Settings from './pages/Settings.jsx'
import Goals from './pages/Goals.jsx'
import History from './pages/History.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Today />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/history" element={<History />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/add-friend" element={<AddFriend />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
