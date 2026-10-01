import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '../api.js'
import Page from '../components/Page.jsx'
import { Avatar, SectionTitle } from '../components/PersonRow.jsx'
import { FriendGoalList } from '../components/FriendCard.jsx'
import { MilestoneBadge } from '../components/Milestone.jsx'
import PostFeed from '../components/PostFeed.jsx'
import { SmallButton } from '../components/Form.jsx'
import { ChevronLeftIcon } from '../components/Icons.jsx'
import { ErrorState, LoadingState } from '../components/States.jsx'
import { formatShortDate } from '../dates.js'

function Stat({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-ink-900/70 px-3 py-3 text-center">
      <p className="text-2xl font-semibold text-ice-50 tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-steel-500">{label}</p>
    </div>
  )
}

export default function Profile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')

  function loadProfile(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    api(`/people/${userId}`)
      .then((result) => {
        setProfile(result)
        setStatus('ready')
      })
      .catch((error) => {
        if (showSpinner) {
          setLoadError(error.message)
          setStatus('error')
        }
      })
  }

  useEffect(() => {
    loadProfile(true)
    function handleActivity(event) {
      const changedId = event.detail ? event.detail.userId : null
      if (changedId === null || changedId === Number(userId)) {
        loadProfile(false)
      }
    }
    window.addEventListener('winterarc:activity', handleActivity)
    return () => window.removeEventListener('winterarc:activity', handleActivity)
  }, [userId])

  function goBack() {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate('/friends')
    }
  }

  const backButton = (
    <SmallButton onClick={goBack} className="flex shrink-0 items-center gap-1 pl-3">
      <ChevronLeftIcon className="size-4" />
      Back
    </SmallButton>
  )

  if (status !== 'ready') {
    return (
      <Page eyebrow="Profile" title="Profile" action={backButton}>
        {status === 'loading' && <LoadingState message="Loading profile…" />}
        {status === 'error' && <ErrorState message={loadError} onRetry={() => loadProfile(true)} />}
      </Page>
    )
  }

  const { user, isYou, today, goals, milestones, stats } = profile
  const name = isYou ? 'You' : user.displayName

  return (
    <Page eyebrow={isYou ? 'Your profile' : 'Friend'} title={user.displayName} action={backButton}>
      <section className="flex animate-fade-up items-center gap-4">
        <Avatar user={user} large />
        <div className="min-w-0">
          <p className="truncate text-sm text-steel-400">@{user.username}</p>
          <p className="mt-1 text-sm text-steel-300">
            {today.total === 0
              ? 'No goals yet'
              : today.done === today.total
                ? 'All done today'
                : `${today.done}/${today.total} done today`}
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-2">
        <Stat value={stats.checkoffs} label="Check-offs" />
        <Stat value={stats.bestStreak} label="Best streak" />
        <Stat value={milestones.length} label={milestones.length === 1 ? 'Badge' : 'Badges'} />
      </section>
      <p className="mt-2 px-1 text-xs text-steel-500">This season, Oct 1 to Dec 31. Best streak is in days, on daily goals.</p>

      {milestones.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Badges</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2.5">
                <MilestoneBadge streak={milestone.streak} frequency={milestone.goal.frequency} />
                <span className="min-w-0 flex-1 truncate text-sm text-steel-200">{milestone.goal.title}</span>
                <span className="shrink-0 text-xs text-steel-500">{formatShortDate(milestone.reachedOn)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>Goals</SectionTitle>
        {goals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-5 py-6 text-center text-sm text-steel-400">
            {isYou ? 'You haven’t' : `${user.displayName} hasn’t`} added any goals yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <FriendGoalList label="Daily" goals={goals.filter((goal) => goal.frequency === 'daily')} />
            <FriendGoalList label="Weekly" goals={goals.filter((goal) => goal.frequency === 'weekly')} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>Board posts</SectionTitle>
        <PostFeed
          userId={user.id}
          emptyState={
            <p className="rounded-2xl border border-dashed border-white/10 px-5 py-6 text-center text-sm text-steel-400">
              {name === 'You' ? 'You haven’t' : `${name} hasn’t`} posted yet.
            </p>
          }
        />
      </section>
    </Page>
  )
}
