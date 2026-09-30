import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../AuthContext.jsx'
import { api } from '../api.js'
import { syncPush } from '../push.js'
import { Avatar } from './PersonRow.jsx'
import Intro from './Intro.jsx'
import { AccountIcon, BoardIcon, CalendarIcon, FriendsIcon, TodayIcon } from './Icons.jsx'

const tabs = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/history', label: 'History', icon: CalendarIcon },
  { to: '/friends', label: 'Friends', icon: FriendsIcon },
  { to: '/board', label: 'Board', icon: BoardIcon },
  { to: '/account', label: 'Account', icon: AccountIcon },
]

const RECONNECT_MS = 5000
const DESKTOP_QUERY = '(min-width: 64rem)'
const RAIL_ITEM_HEIGHT = 48

function announceActivity(userId) {
  window.dispatchEvent(new CustomEvent('winterarc:activity', { detail: { userId } }))
}

function announceBoard() {
  window.dispatchEvent(new Event('winterarc:board'))
}

function UnreadDot({ className = '' }) {
  return (
    <span
      className={`absolute size-2 rounded-full bg-ice-300 shadow-[0_0_8px_rgb(174_219_255/0.9)] ring-2 ring-black ${className}`}
      aria-hidden="true"
    />
  )
}

function tabLabel(tab, boardUnread) {
  return tab.to === '/board' && boardUnread ? `${tab.label}, new posts` : undefined
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    function handleChange() {
      setIsDesktop(query.matches)
    }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])
  return isDesktop
}

function activeTabIndex(pathname) {
  if (pathname === '/' || pathname === '/goals') {
    return 0
  }
  return tabs.findIndex((tab) => tab.to !== '/' && pathname.startsWith(tab.to))
}

function Clock({ timezone }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: timezone })
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone })
  return (
    <div>
      <p className="font-mono text-[22px] font-medium tracking-[0.08em] text-ice-100 tabular-nums">{time}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-steel-500">{date}</p>
    </div>
  )
}

function LinkStatus({ status }) {
  const live = status === 'live'
  return (
    <div className="flex items-center gap-2.5" role="status">
      <span className="relative flex size-2">
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-ice-300/60" />}
        <span className={`relative size-2 rounded-full ${live ? 'bg-ice-300 shadow-[0_0_8px_rgb(174_219_255/0.9)]' : 'bg-steel-500'}`} />
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-steel-400">
        {live ? 'Sync live' : status === 'connecting' ? 'Linking…' : 'Reconnecting…'}
      </span>
    </div>
  )
}

function DesktopRail({ linkStatus, boardUnread }) {
  const { user } = useAuth()
  const location = useLocation()
  const activeIndex = activeTabIndex(location.pathname)

  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-64 flex-col border-r border-white/[0.06] bg-ink-950/80 px-4 py-7 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-ice-300/30 to-transparent" aria-hidden="true" />
      <div className="flex animate-rail-in items-center gap-3 px-2">
        <img src="/icon.svg" alt="" className="size-9 rounded-xl shadow-[0_0_20px_-4px_rgb(132_197_255/0.5)]" />
        <div>
          <p className="text-[15px] font-semibold tracking-[0.18em] text-ice-50">WINTER ARC</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-steel-500">Oct 1 → Jan 1</p>
        </div>
      </div>

      <nav className="relative mt-10" aria-label="Main">
        {activeIndex >= 0 && (
          <span
            className="absolute inset-x-0 top-0 rounded-xl border border-ice-300/15 bg-gradient-to-r from-ice-300/[0.1] via-ice-300/[0.04] to-transparent shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ height: RAIL_ITEM_HEIGHT, transform: `translateY(${activeIndex * (RAIL_ITEM_HEIGHT + 4)}px)` }}
            aria-hidden="true"
          >
            <span className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-ice-300 shadow-[0_0_12px_2px_rgb(174_219_255/0.6)]" />
          </span>
        )}
        <ul className="relative flex flex-col gap-1">
          {tabs.map((tab, index) => (
            <li key={tab.to} className="animate-rail-in" style={{ animationDelay: `${80 + index * 50}ms` }}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors ${
                    isActive || index === activeIndex ? 'text-ice-50' : 'text-steel-400 hover:bg-white/[0.03] hover:text-steel-200'
                  }`
                }
                style={{ height: RAIL_ITEM_HEIGHT }}
                aria-label={tabLabel(tab, boardUnread)}
              >
                <span className="relative">
                  <tab.icon
                    className={`size-5 transition ${index === activeIndex ? 'text-ice-200 drop-shadow-[0_0_8px_rgb(174_219_255/0.6)]' : 'group-hover:text-steel-200'}`}
                  />
                  {tab.to === '/board' && boardUnread && <UnreadDot className="-top-0.5 -right-0.5" />}
                </span>
                <span className="flex-1">{tab.label}</span>
                <kbd className="rounded-md border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-steel-500 opacity-0 transition group-hover:opacity-100">
                  {index + 1}
                </kbd>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto flex animate-rail-in flex-col gap-5 px-2" style={{ animationDelay: '380ms' }}>
        <div className="hud rounded-xl border border-white/[0.06] bg-ink-900/60 p-4">
          <Clock timezone={user.timezone} />
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <LinkStatus status={linkStatus} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ice-50">{user.displayName}</p>
            <p className="truncate text-xs text-steel-500">@{user.username}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function MobileTabs({ boardUnread }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-white/[0.06] bg-black/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              aria-label={tabLabel(tab, boardUnread)}
              className={({ isActive }) =>
                `relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide whitespace-nowrap transition-colors ${
                  isActive ? 'text-ice-100' : 'text-steel-500 active:text-steel-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 h-px w-10 bg-gradient-to-r from-transparent via-ice-300 to-transparent shadow-[0_0_12px_2px_rgb(174_219_255/0.45)]" />
                  )}
                  <span className="relative">
                    <tab.icon className={`size-6 ${isActive ? 'drop-shadow-[0_0_8px_rgb(174_219_255/0.5)]' : ''}`} />
                    {tab.to === '/board' && boardUnread && <UnreadDot className="-top-0.5 -right-1" />}
                  </span>
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function isTyping(target) {
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export default function Layout() {
  const isDesktop = useIsDesktop()
  const location = useLocation()
  const navigate = useNavigate()
  const [linkStatus, setLinkStatus] = useState('connecting')
  const [hasUnreadPosts, setHasUnreadPosts] = useState(false)
  const { user, setUser } = useAuth()
  const [introOpen, setIntroOpen] = useState(user.showIntro)
  const boardUnread = hasUnreadPosts && location.pathname !== '/board'

  useEffect(() => {
    syncPush().catch(() => {})
    function handleIntro() {
      setIntroOpen(true)
    }
    window.addEventListener('winterarc:intro', handleIntro)
    return () => window.removeEventListener('winterarc:intro', handleIntro)
  }, [])

  const closeIntro = useCallback(() => {
    setIntroOpen(false)
    if (user.showIntro) {
      api('/me/intro', { method: 'POST' })
        .then((data) => setUser(data.user))
        .catch(() => {})
    }
  }, [user.showIntro, setUser])

  const intro = introOpen && <Intro onClose={closeIntro} />

  useEffect(() => {
    let latestRequest = 0
    function loadUnread() {
      latestRequest += 1
      const request = latestRequest
      api('/posts/unread')
        .then((result) => {
          if (request === latestRequest) {
            setHasUnreadPosts(result.unread)
          }
        })
        .catch(() => {})
    }
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        loadUnread()
      }
    }
    loadUnread()
    window.addEventListener('winterarc:board', loadUnread)
    window.addEventListener('winterarc:board-seen', loadUnread)
    document.addEventListener('visibilitychange', handleVisible)
    return () => {
      window.removeEventListener('winterarc:board', loadUnread)
      window.removeEventListener('winterarc:board-seen', loadUnread)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [])

  useEffect(() => {
    let source = null
    let retryTimer = null
    let lostConnection = false

    function connect() {
      source = new EventSource('/api/events')
      source.addEventListener('open', () => {
        setLinkStatus('live')
        if (lostConnection) {
          lostConnection = false
          announceActivity(null)
          announceBoard()
        }
      })
      source.addEventListener('activity', (event) => {
        announceActivity(JSON.parse(event.data).userId)
      })
      source.addEventListener('board', announceBoard)
      source.addEventListener('board-seen', () => {
        window.dispatchEvent(new Event('winterarc:board-seen'))
      })
      source.addEventListener('error', () => {
        lostConnection = true
        setLinkStatus('reconnecting')
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

  useEffect(() => {
    if (!isDesktop) {
      return
    }
    let frame = 0
    function handleMove(event) {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mx', `${event.clientX}px`)
        document.documentElement.style.setProperty('--my', `${event.clientY}px`)
      })
    }
    function handleKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) {
        return
      }
      const tab = tabs[Number(event.key) - 1]
      if (tab) {
        navigate(tab.to)
      }
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('keydown', handleKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('keydown', handleKey)
    }
  }, [isDesktop, navigate])

  if (isDesktop) {
    return (
      <div className="desktop-shell min-h-dvh pl-64">
        <DesktopRail linkStatus={linkStatus} boardUnread={boardUnread} />
        <div key={location.pathname} className="animate-page-in">
          <Outlet />
        </div>
        {intro}
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <MobileTabs boardUnread={boardUnread} />
      {intro}
    </div>
  )
}
