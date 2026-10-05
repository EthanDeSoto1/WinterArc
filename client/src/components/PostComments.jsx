import { useState } from 'react'
import { useAuth } from '../AuthContext.jsx'
import { api } from '../api.js'
import { Avatar } from './PersonRow.jsx'
import { SmallButton } from './Form.jsx'
import { CrossIcon } from './Icons.jsx'
import { formatPostedWhen } from '../dates.js'
import { REACTIONS, chooseReaction, reactionLabel } from '../reactions.js'

const MAX_WORDS = 100
const SHOWN_COMMENTS = 3

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function PostComments({ post, board, timezone, onChange, onError }) {
  const { user } = useAuth()
  const me = { id: user.id, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor }
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const words = countWords(text)
  const hidden = expanded ? 0 : Math.max(0, post.comments.length - SHOWN_COMMENTS)
  const shown = post.comments.slice(hidden)

  async function handleSubmit(event) {
    event.preventDefault()
    setSending(true)
    try {
      const data = await api(`/posts/${post.id}/comments`, { method: 'POST', body: { body: text } })
      onChange(data.post)
      setText('')
    } catch (error) {
      onError(error.message)
    }
    setSending(false)
  }

  async function handleReact(comment, kind) {
    const reaction = comment.reactions.find((item) => item.kind === kind)
    const optimistic = {
      ...post,
      comments: post.comments.map((item) => (item.id === comment.id ? chooseReaction(item, kind, me) : item)),
    }
    onChange(optimistic)
    try {
      const data = await api(`/posts/${post.id}/comments/${comment.id}/reactions/${kind}`, {
        method: reaction.mine ? 'DELETE' : 'PUT',
      })
      onChange(data.post)
    } catch (error) {
      onChange(post)
      onError(error.message)
    }
  }

  async function handleDelete(comment) {
    const question = comment.isYours ? 'Delete this comment?' : `Delete ${comment.user.displayName}’s comment on your post?`
    if (!window.confirm(question)) {
      return
    }
    setDeletingId(comment.id)
    try {
      const data = await api(`/posts/${post.id}/comments/${comment.id}`, { method: 'DELETE' })
      onChange(data.post)
    } catch (error) {
      onError(error.message)
    }
    setDeletingId(null)
  }

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="mb-1 min-h-11 text-sm font-medium text-steel-400 active:text-steel-200">
          View all {post.comments.length} comments
        </button>
      )}
      {shown.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2.5">
          {shown.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2.5">
              <Avatar user={comment.user} small className="mt-1" />
              <div className="min-w-0 flex-1 rounded-xl bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-steel-500">
                  <span className="font-semibold text-ice-100">{comment.isYours ? 'You' : comment.user.displayName}</span>
                  {' · '}
                  <time dateTime={comment.createdAt}>{formatPostedWhen(comment.createdAt, comment.day, board, timezone)}</time>
                </p>
                <p className="mt-0.5 text-sm leading-snug break-words text-steel-200">{comment.body}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {comment.reactions.map((reaction) => {
                    const info = REACTIONS.find((item) => item.kind === reaction.kind)
                    return (
                      <button
                        key={reaction.kind}
                        type="button"
                        onClick={() => handleReact(comment, reaction.kind)}
                        aria-pressed={reaction.mine}
                        aria-label={reactionLabel(info, reaction, me)}
                        title={reaction.people.length > 0 ? reactionLabel(info, reaction, me).split(': ')[1] : undefined}
                        className={`flex min-h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold tabular-nums transition active:scale-95 ${
                          reaction.mine
                            ? 'border-ice-300/40 bg-ice-300/[0.1] text-ice-100'
                            : 'border-white/[0.08] text-steel-400 active:bg-white/5'
                        }`}
                      >
                        <span aria-hidden="true" className="text-sm">
                          {info.emoji}
                        </span>
                        {reaction.count > 0 && <span aria-hidden="true">{reaction.count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
              {comment.canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(comment)}
                  disabled={deletingId === comment.id}
                  aria-label={comment.isYours ? 'Delete your comment' : `Delete ${comment.user.displayName}’s comment`}
                  className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-steel-500 transition active:text-rose-300 disabled:opacity-40 lg:hover:text-rose-300"
                >
                  <CrossIcon className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor={`comment-${post.id}`} className="sr-only">
          Add a comment
        </label>
        <input
          id={`comment-${post.id}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={600}
          placeholder="Add a comment…"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-ink-900 px-3.5 text-base text-ice-50 placeholder:text-steel-500 transition focus:border-ice-400/60 focus:outline-none focus:ring-4 focus:ring-ice-400/10 lg:text-sm"
        />
        <SmallButton type="submit" primary disabled={sending || words === 0 || words > MAX_WORDS} className="shrink-0">
          {sending ? 'Sending…' : 'Send'}
        </SmallButton>
      </form>
      {words > MAX_WORDS - 20 && (
        <p className={`mt-1.5 px-1 text-xs ${words > MAX_WORDS ? 'text-rose-300' : 'text-steel-500'}`}>
          {words > MAX_WORDS ? `${words - MAX_WORDS} words over the limit` : `${MAX_WORDS - words} words left`}
        </p>
      )}
    </div>
  )
}
