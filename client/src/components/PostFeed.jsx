import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { api } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import { Avatar } from './PersonRow.jsx'
import PostComposer from './PostComposer.jsx'
import PostComments from './PostComments.jsx'
import { SmallButton } from './Form.jsx'
import { CrossIcon } from './Icons.jsx'
import { ErrorState, LoadingState, Toast } from './States.jsx'
import { formatPostedWhen } from '../dates.js'
import { REACTIONS, chooseReaction, reactionLabel } from '../reactions.js'

const MAX_FACES = 3
const MAX_LENGTH = 500
const CLOSE_DISTANCE = 100

function photoAlt(post) {
  return `Photo from ${post.isYours ? 'you' : post.user.displayName}`
}

const OPEN_TRANSITION = 'transform 340ms cubic-bezier(0.2, 0.9, 0.25, 1), opacity 200ms ease'
const CLOSE_TRANSITION = 'transform 320ms cubic-bezier(0.3, 0.8, 0.25, 1), opacity 240ms ease'
const SNAP_TRANSITION = 'transform 280ms cubic-bezier(0.2, 0.9, 0.25, 1)'
const CLOSE_MS = 320
const FULL_FADE = 0.95

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function homeBox(image) {
  return { x: image.offsetLeft, y: image.offsetTop, width: image.offsetWidth, height: image.offsetHeight }
}

function photoBox(element, photo) {
  const box = element.getBoundingClientRect()
  const ratio = photo.width / photo.height
  let width = box.width
  let height = box.height
  if (width / height > ratio) {
    width = height * ratio
  } else {
    height = width / ratio
  }
  return { x: box.left + (box.width - width) / 2, y: box.top + (box.height - height) / 2, width, height }
}

function flyTo(from, to) {
  const scale = to.width / from.width
  const moveX = to.x + to.width / 2 - (from.x + from.width / 2)
  const moveY = to.y + to.height / 2 - (from.y + from.height / 2)
  return `translate(${moveX}px, ${moveY}px) scale(${scale})`
}

function isOnScreen(element) {
  if (!element || !element.isConnected) {
    return false
  }
  const box = element.getBoundingClientRect()
  return box.bottom > 0 && box.top < window.innerHeight && box.width > 0
}

function PhotoViewer({ post, source, onClose }) {
  const [motion, setMotion] = useState({ transform: 'none', transition: 'none', opacity: 1 })
  const [fade, setFade] = useState(FULL_FADE)
  const [dragging, setDragging] = useState(false)
  const imageRef = useRef(null)
  const startY = useRef(null)
  const dragY = useRef(0)
  const lastMove = useRef({ y: 0, time: 0, speed: 0 })
  const moved = useRef(false)
  const closing = useRef(false)
  const closeRef = useRef(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !isOnScreen(source)) {
      return
    }
    setMotion({ transform: flyTo(homeBox(imageRef.current), photoBox(source, post.photo)), transition: 'none', opacity: 1 })
    setFade(0)
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setMotion({ transform: 'none', transition: OPEN_TRANSITION, opacity: 1 })
        setFade(FULL_FADE)
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  function close(direction = 0) {
    if (closing.current) {
      return
    }
    closing.current = true
    if (prefersReducedMotion()) {
      onClose()
      return
    }
    if (isOnScreen(source)) {
      setMotion({ transform: flyTo(homeBox(imageRef.current), photoBox(source, post.photo)), transition: CLOSE_TRANSITION, opacity: 1 })
    } else {
      const away = direction * window.innerHeight * 0.6
      setMotion({ transform: `translateY(${away}px) scale(0.9)`, transition: CLOSE_TRANSITION, opacity: 0 })
    }
    setDragging(false)
    setFade(0)
    setTimeout(onClose, CLOSE_MS)
  }
  closeRef.current = close

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') {
        closeRef.current()
      }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  function handlePointerDown(event) {
    if (closing.current || event.target.closest('button')) {
      return
    }
    startY.current = event.clientY
    dragY.current = 0
    lastMove.current = { y: event.clientY, time: event.timeStamp, speed: 0 }
    moved.current = false
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    if (startY.current === null) {
      return
    }
    const distance = event.clientY - startY.current
    const elapsed = event.timeStamp - lastMove.current.time
    if (elapsed > 0) {
      lastMove.current = { y: event.clientY, time: event.timeStamp, speed: (event.clientY - lastMove.current.y) / elapsed }
    }
    if (Math.abs(distance) > 6) {
      moved.current = true
    }
    dragY.current = distance
    const shrink = 1 - Math.min(Math.abs(distance) / 1200, 0.12)
    setMotion({ transform: `translateY(${distance}px) scale(${shrink})`, transition: 'none', opacity: 1 })
    setFade(FULL_FADE - Math.min(Math.abs(distance) / 500, 0.55))
  }

  function handlePointerUp() {
    if (startY.current === null) {
      return
    }
    startY.current = null
    setDragging(false)
    const distance = dragY.current
    const flick = Math.abs(lastMove.current.speed) > 0.6 && Math.abs(distance) > 24
    if (Math.abs(distance) > CLOSE_DISTANCE || flick) {
      close(Math.sign(distance))
    } else {
      setMotion({ transform: 'none', transition: SNAP_TRANSITION, opacity: 1 })
      setFade(FULL_FADE)
    }
  }

  function handleClick() {
    if (!moved.current) {
      close()
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photoAlt(post)}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        backgroundColor: `rgb(0 0 0 / ${fade})`,
        transition: dragging ? 'none' : `background-color ${CLOSE_MS}ms ease`,
      }}
      className="fixed inset-0 z-30 flex touch-none items-center justify-center px-2 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] select-none"
    >
      <button
        type="button"
        onClick={() => close()}
        autoFocus
        aria-label="Close photo"
        style={{ opacity: fade / FULL_FADE, transition: dragging ? 'none' : `opacity ${CLOSE_MS}ms ease` }}
        className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] right-2 flex size-11 items-center justify-center rounded-full bg-white/10 text-ice-50 active:bg-white/20 lg:hover:bg-white/20"
      >
        <CrossIcon className="size-5" />
      </button>
      <img
        ref={imageRef}
        src={`/api/posts/${post.id}/photo?v=${post.photo.version}`}
        alt={photoAlt(post)}
        width={post.photo.width}
        height={post.photo.height}
        draggable={false}
        style={motion}
        className="h-auto max-h-full w-auto max-w-full rounded-2xl object-contain will-change-transform"
      />
    </div>,
    document.body,
  )
}

function PostEditor({ post, onSaved, onCancel }) {
  const [text, setText] = useState(post.body)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const result = await api(`/posts/${post.id}`, { method: 'PATCH', body: { body: text } })
      onSaved(result.post)
    } catch (saveError) {
      setError(saveError.message)
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        aria-label={post.photo ? 'Edit caption' : 'Edit post'}
        rows={3}
        value={text}
        maxLength={MAX_LENGTH}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            save()
          }
          if (event.key === 'Escape') {
            onCancel()
          }
        }}
        className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-ink-950 px-4 py-3 text-base text-ice-50 transition focus:border-ice-400/60 focus:outline-none focus:ring-4 focus:ring-ice-400/10"
      />
      {error && (
        <p className="text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <SmallButton onClick={onCancel} disabled={saving}>
          Cancel
        </SmallButton>
        <SmallButton primary onClick={save} disabled={saving || (!post.photo && text.trim() === '')}>
          {saving ? 'Saving…' : 'Save'}
        </SmallButton>
      </div>
    </div>
  )
}

function PostCard({ post, board, me, timezone, onReact, onDelete, onChange, onError, onOpenPhoto, viewing, deleting }) {
  const [editing, setEditing] = useState(false)
  return (
    <li className="rounded-2xl border border-white/[0.06] bg-ink-900/70 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] transition lg:hover:border-ice-300/30 lg:hover:shadow-[0_0_28px_-12px_rgb(174_219_255/0.5)]">
      <div className="flex items-center gap-3">
        <Link
          to={`/people/${post.user.id}`}
          aria-label={post.isYours ? 'Your profile' : `${post.user.displayName}’s profile`}
          className="-m-0.5 shrink-0 rounded-full p-0.5 transition active:opacity-70"
        >
          <Avatar user={post.user} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ice-50">{post.isYours ? 'You' : post.user.displayName}</p>
          <p className="truncate text-xs text-steel-500">
            <time dateTime={post.createdAt}>{formatPostedWhen(post.createdAt, post.day, board, timezone)}</time>
            {post.editedAt && <span> · edited</span>}
          </p>
        </div>
        {post.isYours && !editing && (
          <SmallButton onClick={() => setEditing(true)} aria-label="Edit this post" className="px-3 text-steel-400">
            Edit
          </SmallButton>
        )}
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
      {editing ? (
        <PostEditor
          post={post}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            onChange(updated)
            setEditing(false)
          }}
        />
      ) : (
        post.body && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-steel-200">{post.body}</p>
      )}
      {post.photo && (
        <button
          type="button"
          onClick={(event) => onOpenPhoto(post.id, event.currentTarget.querySelector('img'))}
          aria-label={`${photoAlt(post)}, open full screen`}
          className="mt-3 block w-full cursor-zoom-in rounded-xl transition active:opacity-80"
        >
          <img
            src={`/api/posts/${post.id}/photo?v=${post.photo.version}`}
            alt=""
            width={post.photo.width}
            height={post.photo.height}
            loading="lazy"
            className={`h-auto max-h-[32rem] w-full rounded-xl border border-white/[0.06] bg-ink-850 object-contain ${viewing ? 'opacity-0' : ''}`}
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

export default function PostFeed({ userId = null, showComposer = false, emptyState }) {
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
  const photoSource = useRef(null)
  const pendingCount = useRef(0)
  const missedSync = useRef(false)
  const reactionQueue = useRef(Promise.resolve())
  const filter = userId ? `userId=${userId}` : ''

  function loadBoard(showSpinner) {
    if (showSpinner) {
      setStatus('loading')
    }
    api(filter ? `/posts?${filter}` : '/posts')
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
        if (!filter && result.posts.length > 0 && document.visibilityState === 'visible') {
          const seen = result.latestCommentId > 0 ? { postId: result.posts[0].id, commentId: result.latestCommentId } : { postId: result.posts[0].id }
          api('/posts/seen', { method: 'POST', body: seen }).catch(() => {})
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
  }, [user.timezone, filter])

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
      const result = await api(`/posts?before=${posts[posts.length - 1].id}${filter ? `&${filter}` : ''}`)
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

  function openPhoto(postId, element) {
    photoSource.current = element
    setViewingId(postId)
  }

  function closePhoto() {
    setViewingId(null)
  }

  function handlePosted(post) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
  }

  return (
    <>
      {status === 'loading' && <LoadingState message="Loading posts…" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={() => loadBoard(true)} />}
      {status === 'ready' && (
        <>
          {showComposer && <PostComposer onPosted={handlePosted} />}
          {posts.length === 0 && <div className={showComposer ? 'mt-6' : ''}>{emptyState}</div>}
          {posts.length > 0 && (
            <ul className={`stagger flex flex-col gap-3 ${showComposer ? 'mt-6' : ''}`}>
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
                  onOpenPhoto={openPhoto}
                  viewing={viewingId === post.id}
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
      {viewingPost && <PhotoViewer post={viewingPost} source={photoSource.current} onClose={closePhoto} />}
      <Toast message={toast} />
    </>
  )
}
