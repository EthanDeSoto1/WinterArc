import express from 'express'
import session from 'express-session'
import path from 'node:path'
import db from './db.js'
import SqliteSessionStore from './sessionStore.js'
import authRoutes, { SESSION_COOKIE_NAME } from './auth.js'
import goalRoutes from './goals.js'
import friendRoutes from './friends.js'
import historyRoutes from './history.js'
import feedRoutes from './feed.js'

const sessionSecret = process.env.SESSION_SECRET || ''
if (sessionSecret.length < 32) {
  console.error('SESSION_SECRET must be set to at least 32 random characters. See .env.example and the README.')
  process.exit(1)
}

const app = express()
const port = Number(process.env.PORT) || 3000
const clientDist = process.env.CLIENT_DIST || path.resolve(import.meta.dirname, '../../client/dist')

app.disable('x-powered-by')
app.set('trust proxy', 'loopback, linklocal, uniquelocal')

app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT 1 AS ok').get()
  res.json({ status: 'ok', database: row.ok === 1 ? 'ok' : 'error' })
})

app.use('/api', express.json({ limit: '10kb' }))

app.use('/api', (req, res, next) => {
  if (req.body === undefined) {
    req.body = {}
  }
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' })
  }
  next()
})

app.use(
  '/api',
  session({
    name: SESSION_COOKIE_NAME,
    secret: sessionSecret,
    store: new SqliteSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
)

app.use('/api', authRoutes)
app.use('/api', goalRoutes)
app.use('/api', friendRoutes)
app.use('/api', historyRoutes)
app.use('/api', feedRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(express.static(clientDist))

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next()
  }
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  if (status >= 500) {
    console.error(err)
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' })
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' })
  }
  const message = status >= 500 ? 'Something went wrong' : err.expose ? err.message : 'Request failed'
  res.status(status).json({ error: message })
})

const server = app.listen(port, () => {
  console.log(`Winter Arc listening on port ${port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
