import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { FormError, PrimaryButton } from './Form.jsx'
import { CrossIcon, PhotoIcon } from './Icons.jsx'

const MAX_LENGTH = 500
const MAX_PHOTO_SIDE = 1600
const PHOTO_QUALITY = 0.82

async function preparePhoto(file) {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = sourceUrl
    await image.decode()
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    context.fillStyle = '#000'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
    if (!blob) {
      throw new Error('No blob')
    }
    return { blob, width, height, previewUrl: URL.createObjectURL(blob) }
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

export default function PostComposer({ onPosted }) {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef(null)
  const remaining = MAX_LENGTH - text.length
  const canPost = !posting && !preparing && (text.trim() !== '' || photo !== null)

  useEffect(() => {
    if (!photo) {
      return
    }
    return () => URL.revokeObjectURL(photo.previewUrl)
  }, [photo])

  async function handlePick(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) {
      return
    }
    setError('')
    setPreparing(true)
    try {
      setPhoto(await preparePhoto(file))
    } catch {
      setError('Couldn’t read that photo. Try a different one.')
    }
    setPreparing(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setPosting(true)
    try {
      let data
      if (photo) {
        const query = new URLSearchParams({ body: text, width: photo.width, height: photo.height })
        data = await api(`/posts/photo?${query}`, { method: 'POST', body: photo.blob })
      } else {
        data = await api('/posts', { method: 'POST', body: { body: text } })
      }
      onPosted(data.post)
      setText('')
      setPhoto(null)
    } catch (postError) {
      setError(postError.status === 413 ? 'That photo is too large.' : postError.message)
    }
    setPosting(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && canPost) {
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
      {photo && (
        <div className="relative self-start">
          <img
            src={photo.previewUrl}
            alt="Photo to post"
            className="max-h-56 max-w-full rounded-xl border border-white/[0.08] object-contain"
          />
          <button
            type="button"
            onClick={() => setPhoto(null)}
            disabled={posting}
            aria-label="Remove photo"
            className="absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-full border border-white/10 bg-black/70 text-ice-50 backdrop-blur transition active:scale-95 disabled:opacity-40"
          >
            <CrossIcon className="size-5" />
          </button>
        </div>
      )}
      <FormError message={error} />
      <input ref={fileInput} type="file" accept="image/*" onChange={handlePick} className="hidden" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInput.current.click()}
          disabled={posting || preparing}
          aria-label={photo ? 'Change photo' : 'Add a photo'}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-steel-300 transition active:scale-95 active:bg-white/5 disabled:opacity-40 lg:hover:border-ice-300/30 lg:hover:text-ice-100"
        >
          {preparing ? (
            <span className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-ice-300" />
          ) : (
            <PhotoIcon className="size-6" />
          )}
        </button>
        <p className="min-w-0 flex-1 text-xs text-steel-500">
          {remaining <= 100 ? `${remaining} characters left` : 'Everyone on Winter Arc sees posts.'}
        </p>
        <PrimaryButton type="submit" disabled={!canPost} className="shrink-0">
          {posting ? (photo ? 'Uploading…' : 'Posting…') : 'Post'}
        </PrimaryButton>
      </div>
    </form>
  )
}
