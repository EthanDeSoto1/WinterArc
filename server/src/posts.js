import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import db from './db.js'
import { requireAuth } from './auth.js'
import { notifyBoard } from './events.js'
import { areFriends } from './friends.js'
import {
  readId,
  readPostBody,
  readCaption,
  readPhotoSide,
  readReactionKind,
  firstError,
  REACTION_KINDS,
} from './validation.js'
import { todayInTimezone, addDays } from './dates.js'

const PAGE_SIZE = 20
const MAX_PHOTO_BYTES = 3 * 1024 * 1024
const MAX_PHOTOS_PER_DAY = 20
const photoDir = process.env.PHOTO_DIR || path.join(path.dirname(db.name), 'photos')
fs.mkdirSync(photoDir, { recursive: true })

const findPosts = db.prepare(`
  SELECT posts.id, posts.body, posts.created_at, posts.photo, posts.photo_width, posts.photo_height,
    users.id AS user_id, users.username, users.display_name, users.avatar_color
  FROM posts
  JOIN users ON users.id = posts.user_id
  WHERE posts.id < ?
    AND (posts.user_id = ?
      OR posts.user_id IN (
        SELECT addressee_id FROM friendships WHERE requester_id = ? AND status = 'accepted'
        UNION
        SELECT requester_id FROM friendships WHERE addressee_id = ? AND status = 'accepted'
      ))
  ORDER BY posts.id DESC
  LIMIT ${PAGE_SIZE + 1}
`)
const findPost = db.prepare(`
  SELECT posts.id, posts.body, posts.created_at, posts.photo, posts.photo_width, posts.photo_height,
    users.id AS user_id, users.username, users.display_name, users.avatar_color
  FROM posts
  JOIN users ON users.id = posts.user_id
  WHERE posts.id = ?
`)
const findReactions = db.prepare(`
  SELECT post_id, kind, count(*) AS count, max(user_id = ?) AS mine
  FROM post_reactions
  WHERE post_id IN (SELECT value FROM json_each(?))
  GROUP BY post_id, kind
`)
const countRecentPhotos = db.prepare(`
  SELECT count(*) AS count FROM posts
  WHERE user_id = ? AND photo IS NOT NULL AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')
`)
const insertPost = db.prepare('INSERT INTO posts (user_id, body) VALUES (?, ?)')
const insertPhotoPost = db.prepare(
  'INSERT INTO posts (user_id, body, photo, photo_width, photo_height) VALUES (?, ?, ?, ?, ?)'
)
const deletePost = db.prepare('DELETE FROM posts WHERE id = ?')
const saveReaction = db.prepare(`
  INSERT INTO post_reactions (post_id, user_id, kind) VALUES (?, ?, ?)
  ON CONFLICT (post_id, user_id) DO UPDATE
    SET kind = excluded.kind, created_at = excluded.created_at
    WHERE kind <> excluded.kind
`)
const deleteReaction = db.prepare('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ? AND kind = ?')

function postsToJson(rows, viewer) {
  const reactionRows = findReactions.all(viewer.id, JSON.stringify(rows.map((row) => row.id)))
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    day: todayInTimezone(viewer.timezone, new Date(row.created_at)),
    isYours: row.user_id === viewer.id,
    photo: row.photo ? { width: row.photo_width, height: row.photo_height } : null,
    user: { id: row.user_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
    reactions: REACTION_KINDS.map((kind) => {
      const match = reactionRows.find((reaction) => reaction.post_id === row.id && reaction.kind === kind)
      return { kind, count: match ? match.count : 0, mine: Boolean(match && match.mine) }
    }),
  }))
}

function isJpeg(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}

function loadVisiblePost(req, res) {
  const id = readId(req.params.id, 'post')
  if (id.error) {
    res.status(400).json({ error: id.error })
    return null
  }
  const post = findPost.get(id.value)
  if (!post || (post.user_id !== req.user.id && !areFriends(post.user_id, req.user.id))) {
    res.status(404).json({ error: 'That post no longer exists' })
    return null
  }
  return post
}

function loadReactionTarget(req, res) {
  const kind = readReactionKind(req.params.kind)
  if (kind.error) {
    res.status(400).json({ error: kind.error })
    return null
  }
  const post = loadVisiblePost(req, res)
  if (!post) {
    return null
  }
  return { post, kind: kind.value }
}

const router = express.Router()

router.get('/posts', requireAuth, (req, res) => {
  const before = req.query.before === undefined ? { value: Number.MAX_SAFE_INTEGER } : readId(req.query.before, 'post')
  if (before.error) {
    return res.status(400).json({ error: before.error })
  }
  const rows = findPosts.all(before.value, req.user.id, req.user.id, req.user.id)
  const today = todayInTimezone(req.user.timezone)
  res.json({
    today,
    yesterday: addDays(today, -1),
    posts: postsToJson(rows.slice(0, PAGE_SIZE), req.user),
    hasMore: rows.length > PAGE_SIZE,
  })
})

router.post('/posts', requireAuth, (req, res) => {
  const body = readPostBody(req.body.body)
  if (body.error) {
    return res.status(400).json({ error: body.error })
  }
  const result = insertPost.run(req.user.id, body.value)
  notifyBoard(req.user.id)
  res.status(201).json({ post: postsToJson([findPost.get(result.lastInsertRowid)], req.user)[0] })
})

router.post(
  '/posts/photo',
  requireAuth,
  express.raw({ type: 'image/jpeg', limit: MAX_PHOTO_BYTES }),
  (req, res) => {
    const body = readCaption(req.query.body)
    const width = readPhotoSide(req.query.width)
    const height = readPhotoSide(req.query.height)
    const error = firstError([body, width, height])
    if (error) {
      return res.status(400).json({ error })
    }
    if (!isJpeg(req.body)) {
      return res.status(400).json({ error: 'The photo must be a JPEG image' })
    }
    if (countRecentPhotos.get(req.user.id).count >= MAX_PHOTOS_PER_DAY) {
      return res.status(429).json({ error: `You can post up to ${MAX_PHOTOS_PER_DAY} photos a day` })
    }

    const photo = `${crypto.randomUUID()}.jpg`
    const photoPath = path.join(photoDir, photo)
    fs.writeFileSync(photoPath, req.body, { mode: 0o600 })
    let result
    try {
      result = insertPhotoPost.run(req.user.id, body.value, photo, width.value, height.value)
    } catch (insertError) {
      fs.rmSync(photoPath, { force: true })
      throw insertError
    }
    notifyBoard(req.user.id)
    res.status(201).json({ post: postsToJson([findPost.get(result.lastInsertRowid)], req.user)[0] })
  }
)

router.get('/posts/:id/photo', requireAuth, (req, res) => {
  const post = loadVisiblePost(req, res)
  if (!post) {
    return
  }
  if (!post.photo) {
    return res.status(404).json({ error: 'That post has no photo' })
  }
  const options = { headers: { 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } }
  res.sendFile(path.join(photoDir, post.photo), options, (sendError) => {
    if (sendError && !res.headersSent) {
      res.status(404).json({ error: 'That photo is missing' })
    }
  })
})

router.delete('/posts/:id', requireAuth, (req, res) => {
  const post = loadVisiblePost(req, res)
  if (!post) {
    return
  }
  if (post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own posts' })
  }
  deletePost.run(post.id)
  if (post.photo) {
    fs.rm(path.join(photoDir, post.photo), { force: true }, () => {})
  }
  notifyBoard(req.user.id)
  res.status(204).end()
})

router.put('/posts/:id/reactions/:kind', requireAuth, (req, res) => {
  const target = loadReactionTarget(req, res)
  if (!target) {
    return
  }
  const result = saveReaction.run(target.post.id, req.user.id, target.kind)
  if (result.changes === 1) {
    notifyBoard(target.post.user_id)
  }
  res.json({ post: postsToJson([target.post], req.user)[0] })
})

router.delete('/posts/:id/reactions/:kind', requireAuth, (req, res) => {
  const target = loadReactionTarget(req, res)
  if (!target) {
    return
  }
  const result = deleteReaction.run(target.post.id, req.user.id, target.kind)
  if (result.changes === 1) {
    notifyBoard(target.post.user_id)
  }
  res.json({ post: postsToJson([target.post], req.user)[0] })
})

export default router
