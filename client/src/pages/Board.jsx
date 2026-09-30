import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import Page from '../components/Page.jsx'
import { Avatar } from '../components/PersonRow.jsx'
import PostComposer from '../components/PostComposer.jsx'
import PostComments from '../components/PostComments.jsx'
import { SmallButton } from '../components/Form.jsx'
import { CrossIcon } from '../components/Icons.jsx'
import { EmptyState, ErrorState, LoadingState, Toast } from '../components/States.jsx'
import { formatPostedWhen } from '../dates.js'

const MAX_FACES = 3

const REACTIONS = [
  { kind: 'fire', emoji: '🔥', label: 'Fire' },
  { kind: 'muscle', emoji: '💪', label: 'Strong' },
  { kind: 'clap', emoji: '👏', label: 'Applause' },
]

function withoutMe(reaction, me) {
  return { ...reaction, mine: false, count: reaction.count - 1, people: reaction.people.filter((person) => person.id !== me.id) }
}

function chooseReaction(post, kind, me) {
  return {
    ...post,
    reactions: post.reactions.map((reaction) => {
      if (reaction.kind === kind && reaction.mine) {
        return withoutMe(reaction, me)
      }
      if (reaction.kind === kind) {
        return { ...reaction, mine: true, count: reaction.count + 1, people: [...reaction.people, me] }
      }
      if (reaction.mine) {
        return withoutMe(reaction, me)
      }
      return reaction
    }),
  }
}

function reactionLabel(info, reaction, me) {
  const names = reaction.people.map((person) => (person.id === me.id ? 'you' : person.displayName))
  return names.length === 0 ? `${info.label}, 0` : `${info.label}, ${names.length}: ${names.join(', ')}`
}

function photoAlt(post) {
  return `Photo from ${post.isYours ? 'you' : post.user.displayName}`
}

function PhotoViewer({ post, onClose }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photoAlt(post)}
      onClick={onClose}
      className="fixed inset-0 z-30 flex animate-fade-up items-center justify-center bg-black/95 px-2 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur"
    >
      <button
        type="button"
        onClick={onClose}
        autoFocus
        aria-label="Close photo"
        className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] right-2 flex size-11 items-center justify-center rounded-full bg-white/10 text-ice-50 transition active:bg-white/20 lg:hover:bg-white/20"
      >
        <CrossIcon className="size-5" />
      </button>
      <img
        src={`/api/posts/${post.id}/photo`}
        alt={photoAlt(post)}
        width={post.photo.width}
        height={post.photo.height}
        className="h-auto max-h-full w-auto max-w-full object-contain"
      />
    </div>
  )
}

function PostCard({ post, board, me, timezone, onReact, onDelete, onChange, onError, onOpenPhoto, deleting }) {
  return (
    <li className="rounded-2xl border border-white/[0.06] bg-ink-900/70 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] transition lg:hover:border-ice-300/30 lg:hover:shadow-[0_0_28px_-12px_rgb(174_219_255/0.5)]">
      <div className="flex items-center gap-3">
        <Avatar user={post.user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ice-50">{post.isYours ? 'You' : post.user.displayName}</p>
          <p className="truncate text-xs text-steel-500">
            <time dateTime={post.createdAt}>{formatPostedWhen(post.createdAt, post.day, board, timezone)}</time>
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
      {post.body && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-steel-200">{post.body}</p>}
      {post.photo && (
        <button
          type="button"
          onClick={() => onOpenPhoto(post.id)}
          aria-label={`${photoAlt(post)}, open full screen`}
          className="mt-3 block w-full cursor-zoom-in rounded-xl transition active:opacity-80"
        >
          <img
            src={`/api/posts/${post.id}/photo`}
            alt=""
            width={post.photo.width}
            height={post.photo.height}
            loading="lazy"
            className="h-auto max-h-[32rem] w-full rounded-xl border border-white/[0.06] bg-ink-850 object-contain"
          />
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {post.reactions.map((reaction) => {
          const info = REACTIONS.find((item) => item.kind === reaction.kind)
          return (
            <button
              key={reaction.kind}
              type="button"
              onClick={() => onReact(post, reaction.kind)}
              aria-pressed={reaction.mine}
              aria-label={reactionLabel(info, reaction, me)}
              title={reaction.people.length > 0 ? reactionLabel(info, reaction, me).split(': ')[1] : undefined}
              className={`flex min-h-11 min-w-14 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold tabular-nums transition active:scale-95 ${
                reaction.mine
                  ? 'border-ice-300/40 bg-ice-300/[0.1] text-ice-100 shadow-[0_0_16px_-6px_rgb(174_219_255/0.7)]'
                  : 'border-white/[0.08] text-steel-400 active:bg-white/5'
              }`}
            >
              <span aria-hidden="true" className="text-base">
                {info.emoji}
              </span>
              {reaction.people.length > 0 && (
                <span className="flex items-center -space-x-1.5" aria-hidden="true">
                  {reaction.people.slice(0, MAX_FACES).map((person) => (
                    <Avatar key={person.id} user={person} small className="ring-2 ring-ink-900" />
                  ))}
                </span>
              )}
              {reaction.people.length > MAX_FACES && (
                <span aria-hidden="true" className="text-xs">
                  +{reaction.people.length - MAX_FACES}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <PostComments post={post} board={board} timezone={timezone} onChange={onChange} onError={onError} />
    </li>
  )
}

export default function Board() {
  const { user } = useAuth()
  const me = { id: user.id, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor }
  const [board, setBoard] = useState(null)
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast] = useState('')
  const [viewingId, setViewingId] = useState(null)
  const pendingCount = useRef(0)
  const missedSync = useRef(false)
  const reactionQueue = useRef(Promise.resolve())

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
        if (result.posts.length > 0 && document.visibilityState === 'visible') {
          api('/posts/seen', { method: 'POST', body: { postId: result.posts[0].id } }).catch(() => {})
        }
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

  function handleReact(post, kind) {
    const reaction = post.reactions.find((item) => item.kind === kind)
    replacePost(chooseReaction(post, kind, me))
    pendingCount.current += 1
    reactionQueue.current = reactionQueue.current.then(async () => {
      try {
        const data = await api(`/posts/${post.id}/reactions/${kind}`, { method: reaction.mine ? 'DELETE' : 'PUT' })
        if (pendingCount.current === 1) {
          replacePost(data.post)
        }
      } catch (error) {
        replacePost(post)
        missedSync.current = true
        setToast(error.status === 0 ? `${error.message} That reaction was not saved.` : error.message)
      }
      finishPending()
    })
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

  const viewingPost = posts.find((post) => post.id === viewingId && post.photo)

  function closePhoto() {
    setViewingId(null)
  }

  function handlePosted(post) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
  }

  return (
    <Page eyebrow="Everyone on Winter Arc" title="Board">
      {status === 'loading' && <LoadingState message="Loading posts…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={() => loadBoard(true)} />}
      {status === 'ready' && (
        <>
          <PostComposer onPosted={handlePosted} />
          {posts.length === 0 && (
            <div className="mt-6">
              <EmptyState title="Nothing posted yet" message="Share a workout, a win, or a tough day. Everyone can react to keep you going." />
            </div>
          )}
          {posts.length > 0 && (
            <ul className="stagger mt-6 flex flex-col gap-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  board={board}
                  me={me}
                  timezone={user.timezone}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onChange={replacePost}
                  onError={setToast}
                  onOpenPhoto={setViewingId}
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
      {viewingPost && <PhotoViewer post={viewingPost} onClose={closePhoto} />}
      <Toast message={toast} />
    </Page>
  )
}
