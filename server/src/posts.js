import express from 'express'
import db from './db.js'
import { requireAuth } from './auth.js'
import { notifyBoard } from './events.js'
import { areFriends } from './friends.js'
import { readId, readPostBody, readReactionKind, REACTION_KINDS } from './validation.js'
import { todayInTimezone, addDays } from './dates.js'

const PAGE_SIZE = 20

const findPosts = db.prepare(`
  SELECT posts.id, posts.body, posts.created_at,
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
  SELECT posts.id, posts.body, posts.created_at,
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
const insertPost = db.prepare('INSERT INTO posts (user_id, body) VALUES (?, ?)')
const deletePost = db.prepare('DELETE FROM posts WHERE id = ?')
const insertReaction = db.prepare(`
  INSERT INTO post_reactions (post_id, user_id, kind) VALUES (?, ?, ?)
  ON CONFLICT (post_id, user_id, kind) DO NOTHING
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
    user: { id: row.user_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
    reactions: REACTION_KINDS.map((kind) => {
      const match = reactionRows.find((reaction) => reaction.post_id === row.id && reaction.kind === kind)
      return { kind, count: match ? match.count : 0, mine: Boolean(match && match.mine) }
    }),
  }))
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

router.delete('/posts/:id', requireAuth, (req, res) => {
  const post = loadVisiblePost(req, res)
  if (!post) {
    return
  }
  if (post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own posts' })
  }
  deletePost.run(post.id)
  notifyBoard(req.user.id)
  res.status(204).end()
})

router.put('/posts/:id/reactions/:kind', requireAuth, (req, res) => {
  const target = loadReactionTarget(req, res)
  if (!target) {
    return
  }
  const result = insertReaction.run(target.post.id, req.user.id, target.kind)
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
