import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router'
import { AddFriendIcon, CalendarIcon, FriendsIcon, SettingsIcon, TodayIcon } from './Icons.jsx'

const tabs = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/history', label: 'History', icon: CalendarIcon },
  { to: '/friends', label: 'Friends', icon: FriendsIcon },
  { to: '/add-friend', label: 'Add friend', icon: AddFriendIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const RECONNECT_MS = 5000

function announceActivity() {
  window.dispatchEvent(new Event('winterarc:activity'))
}

export default function Layout() {
  useEffect(() => {
    let source = null
    let retryTimer = null
    let lostConnection = false

    function connect() {
      source = new EventSource('/api/events')
      source.addEventListener('open', () => {
        if (lostConnection) {
          lostConnection = false
          announceActivity()
        }
      })
      source.addEventListener('activity', announceActivity)
      source.addEventListener('error', () => {
        lostConnection = true
        if (source.readyState === EventSource.CLOSED) {
          retryTimer = setTimeout(connect, RECONNECT_MS)
        }
      })
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      source.close()
    }
  }, [])

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-white/[0.06] bg-black/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <ul className="mx-auto flex max-w-md">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide transition-colors ${
                    isActive ? 'text-ice-100' : 'text-steel-500 active:text-steel-300'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-0 h-px w-10 bg-gradient-to-r from-transparent via-ice-300 to-transparent shadow-[0_0_12px_2px_rgb(174_219_255/0.45)]" />
                    )}
                    <tab.icon className={`size-6 ${isActive ? 'drop-shadow-[0_0_8px_rgb(174_219_255/0.5)]' : ''}`} />
                    {tab.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
