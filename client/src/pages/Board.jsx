import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import Page from '../components/Page.jsx'
import { Avatar } from '../components/PersonRow.jsx'
import { FormError, PrimaryButton, SmallButton } from '../components/Form.jsx'
import { EmptyState, ErrorState, LoadingState, Toast } from '../components/States.jsx'
import { formatShortDate, formatTime } from '../dates.js'

const MAX_LENGTH = 500

const REACTIONS = [
  { kind: 'fire', emoji: '🔥', label: 'Fire' },
  { kind: 'muscle', emoji: '💪', label: 'Strong' },
  { kind: 'clap', emoji: '👏', label: 'Applause' },
]

function postedWhen(post, board, timezone) {
  const time = formatTime(post.createdAt, timezone)
  if (post.day === board.today) {
    return `Today · ${time}`
  }
  if (post.day === board.yesterday) {
    return `Yesterday · ${time}`
  }
  return `${formatShortDate(post.day)} · ${time}`
}

function toggleReaction(post, kind) {
  return {
    ...post,
    reactions: post.reactions.map((reaction) =>
      reaction.kind === kind
        ? { ...reaction, mine: !reaction.mine, count: reaction.count + (reaction.mine ? -1 : 1) }
        : reaction
    ),
  }
}

function Composer({ onPosted }) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const remaining = MAX_LENGTH - text.length

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setPosting(true)
    try {
      const data = await api('/posts', { method: 'POST', body: { body: text } })
      onPosted(data.post)
      setText('')
    } catch (postError) {
      setError(postError.message)
    }
    setPosting(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && text.trim() !== '' && !posting) {
      handleSubmit(event)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hud flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-ink-900/70 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
    >
      <label htmlFor="post-body" className="sr-only">
        New post
      </label>
      <textarea
        id="post-body"
        rows={3}
        value={text}
        maxLength={MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Share a workout, a win, or a rough day…"
        className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-ink-900 px-4 py-3 text-base text-ice-50 placeholder:text-steel-500 transition focus:border-ice-400/60 focus:outline-none focus:ring-4 focus:ring-ice-400/10"
      />
      <FormError message={error} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-steel-500">
          {remaining <= 100 ? `${remaining} characters left` : 'Only you and your friends see posts.'}
        </p>
        <PrimaryButton type="submit" disabled={posting || text.trim() === ''} className="shrink-0">
          {posting ? 'Posting…' : 'Post'}
        </PrimaryButton>
      </div>
    </form>
  )
}

function PostCard({ post, board, timezone, onReact, onDelete, deleting }) {
  return (
    <li className="rounded-2xl border border-white/[0.06] bg-ink-900/70 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] transition lg:hover:border-ice-300/30 lg:hover:shadow-[0_0_28px_-12px_rgb(174_219_255/0.5)]">
      <div className="flex items-center gap-3">
        <Avatar user={post.user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ice-50">{post.isYours ? 'You' : post.user.displayName}</p>
          <p className="truncate text-xs text-steel-500">
            <time dateTime={post.createdAt}>{postedWhen(post, board, timezone)}</time>
          </p>
        </div>
        {post.isYours && (
          <SmallButton
            onClick={() => onDelete(post)}
            disabled={deleting}
            aria-label="Delete this post"
            className="px-3 text-steel-400 active:text-rose-300"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </SmallButton>
        )}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-steel-200">{post.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {post.reactions.map((reaction) => {
          const info = REACTIONS.find((item) => item.kind === reaction.kind)
          return (
            <button
              key={reaction.kind}
              type="button"
              onClick={() => onReact(post, reaction.kind)}
              aria-pressed={reaction.mine}
              aria-label={`${info.label}, ${reaction.count}`}
              className={`flex min-h-11 min-w-14 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums transition active:scale-95 ${
                reaction.mine
                  ? 'border-ice-300/40 bg-ice-300/[0.1] text-ice-100 shadow-[0_0_16px_-6px_rgb(174_219_255/0.7)]'
                  : 'border-white/[0.08] text-steel-400 active:bg-white/5'
              }`}
            >
              <span aria-hidden="true" className="text-base">
                {info.emoji}
              </span>
              {reaction.count > 0 && <span>{reaction.count}</span>}
            </button>
          )
        })}
      </div>
    </li>
  )
}

export default function Board() {
  const { user } = useAuth()
  const [board, setBoard] = useState(null)
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast] = useState('')
  const pendingCount = useRef(0)
  const missedSync = useRef(false)

  function loadBoard(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    api('/posts')
      .then((result) => {
        if (pendingCount.current > 0) {
          missedSync.current = true
          return
        }
        setBoard({ today: result.today, yesterday: result.yesterday })
        setPosts((current) => {
          if (!result.hasMore || showSpinner) {
            return result.posts
          }
          const oldest = result.posts[result.posts.length - 1].id
          return [...result.posts, ...current.filter((post) => post.id < oldest)]
        })
        if (showSpinner || !result.hasMore) {
          setHasMore(result.hasMore)
        }
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
    loadBoard(true)
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        loadBoard(false)
      }
    }
    function handleBoard() {
      loadBoard(false)
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('winterarc:board', handleBoard)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('winterarc:board', handleBoard)
    }
  }, [user.timezone])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  function finishPending() {
    pendingCount.current -= 1
    if (pendingCount.current === 0 && missedSync.current) {
      missedSync.current = false
      loadBoard(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const result = await api(`/posts?before=${posts[posts.length - 1].id}`)
      setPosts((current) => [...current, ...result.posts.filter((post) => !current.some((item) => item.id === post.id))])
      setHasMore(result.hasMore)
    } catch (error) {
      setToast(error.message)
    }
    setLoadingMore(false)
  }

  function replacePost(updated) {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)))
  }

  async function handleReact(post, kind) {
    const reaction = post.reactions.find((item) => item.kind === kind)
    replacePost(toggleReaction(post, kind))
    pendingCount.current += 1
    try {
      const data = await api(`/posts/${post.id}/reactions/${kind}`, { method: reaction.mine ? 'DELETE' : 'PUT' })
      if (pendingCount.current === 1) {
        replacePost(data.post)
      }
    } catch (error) {
      setPosts((current) => current.map((item) => (item.id === post.id ? toggleReaction(item, kind) : item)))
      setToast(error.status === 0 ? `${error.message} That reaction was not saved.` : error.message)
      if (error.status === 404) {
        missedSync.current = true
      }
    }
    finishPending()
  }

  async function handleDelete(post) {
    if (!window.confirm('Delete this post? This can’t be undone.')) {
      return
    }
    setDeletingId(post.id)
    try {
      await api(`/posts/${post.id}`, { method: 'DELETE' })
      setPosts((current) => current.filter((item) => item.id !== post.id))
    } catch (error) {
      setToast(error.message)
    }
    setDeletingId(null)
  }

  function handlePosted(post) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
  }

  return (
    <Page eyebrow="You and your friends" title="Board">
      {status === 'loading' && <LoadingState message="Loading posts…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={() => loadBoard(true)} />}
      {status === 'ready' && (
        <>
          <Composer onPosted={handlePosted} />
          {posts.length === 0 && (
            <div className="mt-6">
              <EmptyState title="Nothing posted yet" message="Share a workout, a win, or a tough day. Your friends can react to keep you going.">
                <Link to="/add-friend" className="flex min-h-11 items-center text-sm font-semibold text-ice-300">
                  Add friends
                </Link>
              </EmptyState>
            </div>
          )}
          {posts.length > 0 && (
            <ul className="stagger mt-6 flex flex-col gap-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  board={board}
                  timezone={user.timezone}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  deleting={deletingId === post.id}
                />
              ))}
            </ul>
          )}
          {hasMore && (
            <SmallButton onClick={loadMore} disabled={loadingMore} className="mt-4 w-full">
              {loadingMore ? 'Loading…' : 'Show older posts'}
            </SmallButton>
          )}
        </>
      )}
      <Toast message={toast} />
    </Page>
  )
}
