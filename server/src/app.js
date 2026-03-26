import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import 'express-async-errors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth.routes.js'

dotenv.config()

const app = express()

// ── Security Headers ──────────────────────────────────────────
app.use(helmet())

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'https://noteflow.vercel.app', // Update with your Vercel URL
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: Origin '${origin}' not allowed`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── Body Parser ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
})

app.use('/api', limiter)
app.use('/api/auth', authLimiter)

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  })
})

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global Error Handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)

  // CORS errors
  if (err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message })
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  })
})

export default app
