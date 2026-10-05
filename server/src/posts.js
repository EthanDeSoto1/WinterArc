import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import db from './db.js'
import { requireAuth } from './auth.js'
import { notifyBoard, notifyBoardSeen } from './events.js'
import { notifyNewPost, notifyReaction, notifyCommentReaction, notifyComment, notifyThread } from './push.js'
import { publicUser, areFriends } from './friends.js'
import {
  readId,
  readPostBody,
  readCommentBody,
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
  SELECT posts.id, posts.body, posts.created_at, posts.edited_at, posts.photo, posts.photo_width, posts.photo_height,
    users.id AS user_id, users.username, users.display_name, users.avatar_color
  FROM posts
  JOIN users ON users.id = posts.user_id
  WHERE posts.id < ?
    AND (? IS NULL OR posts.user_id = ?)
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
  SELECT posts.id, posts.body, posts.created_at, posts.edited_at, posts.photo, posts.photo_width, posts.photo_height,
    users.id AS user_id, users.username, users.display_name, users.avatar_color
  FROM posts
  JOIN users ON users.id = posts.user_id
  WHERE posts.id = ?
`)
const findReactions = db.prepare(`
  SELECT post_reactions.post_id, post_reactions.kind,
    users.id, users.username, users.display_name, users.avatar_color
  FROM post_reactions
  JOIN users ON users.id = post_reactions.user_id
  WHERE post_reactions.post_id IN (SELECT value FROM json_each(?))
  ORDER BY post_reactions.created_at, post_reactions.user_id
`)
const findComments = db.prepare(`
  SELECT post_comments.id, post_comments.post_id, post_comments.body, post_comments.created_at,
    users.id AS user_id, users.username, users.display_name, users.avatar_color
  FROM post_comments
  JOIN users ON users.id = post_comments.user_id
  WHERE post_comments.post_id IN (SELECT value FROM json_each(?))
  ORDER BY post_comments.id
`)
const findCommentReactions = db.prepare(`
  SELECT comment_reactions.comment_id, comment_reactions.kind,
    users.id, users.username, users.display_name, users.avatar_color
  FROM comment_reactions
  JOIN users ON users.id = comment_reactions.user_id
  WHERE comment_reactions.comment_id IN (SELECT value FROM json_each(?))
  ORDER BY comment_reactions.created_at, comment_reactions.user_id
`)
const findComment = db.prepare('SELECT * FROM post_comments WHERE id = ? AND post_id = ?')
const insertComment = db.prepare('INSERT INTO post_comments (post_id, user_id, body) VALUES (?, ?, ?)')
const deleteComment = db.prepare('DELETE FROM post_comments WHERE id = ?')
const countRecentPhotos = db.prepare(`
  SELECT count(*) AS count FROM posts
  WHERE user_id = ? AND photo IS NOT NULL AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')
`)
const insertPost = db.prepare('INSERT INTO posts (user_id, body) VALUES (?, ?)')
const insertPhotoPost = db.prepare(
  'INSERT INTO posts (user_id, body, photo, photo_width, photo_height) VALUES (?, ?, ?, ?, ?)'
)
const deletePost = db.prepare('DELETE FROM posts WHERE id = ?')
const updatePostBody = db.prepare(
  "UPDATE posts SET body = ?, edited_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
)
const saveReaction = db.prepare(`
  INSERT INTO post_reactions (post_id, user_id, kind) VALUES (?, ?, ?)
  ON CONFLICT (post_id, user_id) DO UPDATE
    SET kind = excluded.kind, created_at = excluded.created_at
    WHERE kind <> excluded.kind
`)
const hasUnreadPosts = db.prepare(`
  WITH visible AS (
    SELECT ? AS id
    UNION
    SELECT addressee_id FROM friendships WHERE requester_id = ? AND status = 'accepted'
    UNION
    SELECT requester_id FROM friendships WHERE addressee_id = ? AND status = 'accepted'
  )
  SELECT EXISTS (
    SELECT 1 FROM posts
    WHERE id > ? AND user_id <> ? AND user_id IN (SELECT id FROM visible)
  ) OR EXISTS (
    SELECT 1 FROM post_comments
    JOIN posts ON posts.id = post_comments.post_id
    WHERE post_comments.id > ? AND post_comments.user_id <> ? AND posts.user_id IN (SELECT id FROM visible)
  ) AS unread
`)
const findLatestCommentId = db.prepare(`
  SELECT coalesce(max(post_comments.id), 0) AS id
  FROM post_comments
  JOIN posts ON posts.id = post_comments.post_id
  WHERE posts.user_id = ?
    OR posts.user_id IN (
      SELECT addressee_id FROM friendships WHERE requester_id = ? AND status = 'accepted'
      UNION
      SELECT requester_id FROM friendships WHERE addressee_id = ? AND status = 'accepted'
    )
`)
const markBoardSeen = db.prepare(
  'UPDATE users SET board_seen_post_id = ? WHERE id = ? AND board_seen_post_id < ? AND ? <= (SELECT coalesce(max(id), 0) FROM posts)'
)
const markCommentsSeen = db.prepare(
  'UPDATE users SET board_seen_comment_id = ? WHERE id = ? AND board_seen_comment_id < ? AND ? <= (SELECT coalesce(max(id), 0) FROM post_comments)'
)
const saveCommentReaction = db.prepare(`
  INSERT INTO comment_reactions (comment_id, user_id, kind) VALUES (?, ?, ?)
  ON CONFLICT (comment_id, user_id) DO UPDATE
    SET kind = excluded.kind, created_at = excluded.created_at
    WHERE kind <> excluded.kind
`)
const findMyCommentReaction = db.prepare('SELECT kind FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
const deleteCommentReaction = db.prepare(
  'DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND kind = ?'
)
const findMyReaction = db.prepare('SELECT kind FROM post_reactions WHERE post_id = ? AND user_id = ?')
const deleteReaction = db.prepare('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ? AND kind = ?')

function postsToJson(rows, viewer) {
  const postIds = JSON.stringify(rows.map((row) => row.id))
  const reactionRows = findReactions.all(postIds)
  const commentRows = findComments.all(postIds)
  const commentReactionRows = findCommentReactions.all(JSON.stringify(commentRows.map((comment) => comment.id)))
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    day: todayInTimezone(viewer.timezone, new Date(row.created_at)),
    isYours: row.user_id === viewer.id,
    photo: row.photo ? { width: row.photo_width, height: row.photo_height, version: row.photo.slice(0, 8) } : null,
    user: { id: row.user_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
    reactions: REACTION_KINDS.map((kind) => {
      const people = reactionRows.filter((reaction) => reaction.post_id === row.id && reaction.kind === kind)
      return {
        kind,
        count: people.length,
        mine: people.some((person) => person.id === viewer.id),
        people: people.map(publicUser),
      }
    }),
    comments: commentRows
      .filter((comment) => comment.post_id === row.id)
      .map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at,
        day: todayInTimezone(viewer.timezone, new Date(comment.created_at)),
        isYours: comment.user_id === viewer.id,
        canDelete: comment.user_id === viewer.id || row.user_id === viewer.id,
        reactions: REACTION_KINDS.map((kind) => {
          const people = commentReactionRows.filter((reaction) => reaction.comment_id === comment.id && reaction.kind === kind)
          return {
            kind,
            count: people.length,
            mine: people.some((person) => person.id === viewer.id),
            people: people.map(publicUser),
          }
        }),
        user: { id: comment.user_id, username: comment.username, displayName: comment.display_name, avatarColor: comment.avatar_color },
      })),
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
  const author = req.query.userId === undefined ? { value: null } : readId(req.query.userId, 'user')
  if (author.error) {
    return res.status(400).json({ error: author.error })
  }
  const rows = findPosts.all(before.value, author.value, author.value, req.user.id, req.user.id, req.user.id)
  const today = todayInTimezone(req.user.timezone)
  res.json({
    today,
    yesterday: addDays(today, -1),
    posts: postsToJson(rows.slice(0, PAGE_SIZE), req.user),
    hasMore: rows.length > PAGE_SIZE,
    latestCommentId: findLatestCommentId.get(req.user.id, req.user.id, req.user.id).id,
  })
})

router.get('/posts/unread', requireAuth, (req, res) => {
  const me = req.user
  const unread = hasUnreadPosts.get(me.id, me.id, me.id, me.board_seen_post_id, me.id, me.board_seen_comment_id, me.id).unread
  res.json({ unread: unread === 1 })
})

router.post('/posts/seen', requireAuth, (req, res) => {
  const postId = readId(req.body.postId, 'post')
  const commentId = req.body.commentId === undefined ? { value: 0 } : readId(req.body.commentId, 'comment')
  const error = firstError([postId, commentId])
  if (error) {
    return res.status(400).json({ error })
  }
  const posts = markBoardSeen.run(postId.value, req.user.id, postId.value, postId.value)
  const comments = markCommentsSeen.run(commentId.value, req.user.id, commentId.value, commentId.value)
  if (posts.changes + comments.changes > 0) {
    notifyBoardSeen(req.user.id)
  }
  res.status(204).end()
})

router.post('/posts', requireAuth, (req, res) => {
  const body = readPostBody(req.body.body)
  if (body.error) {
    return res.status(400).json({ error: body.error })
  }
  const result = insertPost.run(req.user.id, body.value)
  notifyBoard(req.user.id)
  notifyNewPost(req.user, body.value, false)
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
    notifyNewPost(req.user, body.value, true)
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

router.patch('/posts/:id', requireAuth, (req, res) => {
  const post = loadVisiblePost(req, res)
  if (!post) {
    return
  }
  if (post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own posts' })
  }
  if (req.body.body === undefined) {
    return res.status(400).json({ error: 'Nothing to update' })
  }
  const body = post.photo ? readCaption(req.body.body) : readPostBody(req.body.body)
  if (body.error) {
    return res.status(400).json({ error: body.error })
  }
  if (body.value !== post.body) {
    updatePostBody.run(body.value, post.id)
    notifyBoard(req.user.id)
  }
  res.json({ post: postsToJson([findPost.get(post.id)], req.user)[0] })
})

router.post('/posts/:id/comments', requireAuth, (req, res) => {
  const post = loadVisiblePost(req, res)
  if (!post) {
    return
  }
  const body = readCommentBody(req.body.body)
  if (body.error) {
    return res.status(400).json({ error: body.error })
  }
  insertComment.run(post.id, req.user.id, body.value)
  notifyBoard(post.user_id)
  notifyComment(post, req.user, body.value)
  notifyThread(post, req.user, body.value, (readerId) => areFriends(post.user_id, readerId))
  res.status(201).json({ post: postsToJson([post], req.user)[0] })
})

router.delete('/posts/:id/comments/:commentId', requireAuth, (req, res) => {
  const post = loadVisiblePost(req, res)
  if (!post) {
    return
  }
  const commentId = readId(req.params.commentId, 'comment')
  if (commentId.error) {
    return res.status(400).json({ error: commentId.error })
  }
  const comment = findComment.get(commentId.value, post.id)
  if (!comment) {
    return res.status(404).json({ error: 'That comment no longer exists' })
  }
  if (comment.user_id !== req.user.id && post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own comments or comments on your posts' })
  }
  deleteComment.run(comment.id)
  notifyBoard(post.user_id)
  res.json({ post: postsToJson([post], req.user)[0] })
})

function loadCommentReactionTarget(req, res) {
  const kind = readReactionKind(req.params.kind)
  if (kind.error) {
    res.status(400).json({ error: kind.error })
    return null
  }
  const post = loadVisiblePost(req, res)
  if (!post) {
    return null
  }
  const commentId = readId(req.params.commentId, 'comment')
  if (commentId.error) {
    res.status(400).json({ error: commentId.error })
    return null
  }
  const comment = findComment.get(commentId.value, post.id)
  if (!comment) {
    res.status(404).json({ error: 'That comment no longer exists' })
    return null
  }
  return { post, comment, kind: kind.value }
}

router.put('/posts/:id/comments/:commentId/reactions/:kind', requireAuth, (req, res) => {
  const target = loadCommentReactionTarget(req, res)
  if (!target) {
    return
  }
  const hadReaction = findMyCommentReaction.get(target.comment.id, req.user.id) !== undefined
  const result = saveCommentReaction.run(target.comment.id, req.user.id, target.kind)
  if (result.changes === 1) {
    notifyBoard(target.post.user_id)
  }
  if (result.changes === 1 && !hadReaction) {
    notifyCommentReaction(target.comment, req.user, target.kind)
  }
  res.json({ post: postsToJson([target.post], req.user)[0] })
})

router.delete('/posts/:id/comments/:commentId/reactions/:kind', requireAuth, (req, res) => {
  const target = loadCommentReactionTarget(req, res)
  if (!target) {
    return
  }
  const result = deleteCommentReaction.run(target.comment.id, req.user.id, target.kind)
  if (result.changes === 1) {
    notifyBoard(target.post.user_id)
  }
  res.json({ post: postsToJson([target.post], req.user)[0] })
})

router.put('/posts/:id/reactions/:kind', requireAuth, (req, res) => {
  const target = loadReactionTarget(req, res)
  if (!target) {
    return
  }
  const hadReaction = findMyReaction.get(target.post.id, req.user.id) !== undefined
  const result = saveReaction.run(target.post.id, req.user.id, target.kind)
  if (result.changes === 1) {
    notifyBoard(target.post.user_id)
  }
  if (result.changes === 1 && !hadReaction) {
    notifyReaction(target.post, req.user, target.kind)
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
