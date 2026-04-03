require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes     = require('./routes/auth.routes');
const classroomRoutes = require('./routes/classroom.routes');
const syllabusRoutes = require('./routes/syllabus.routes');
const resourceRoutes = require('./routes/resource.routes');
const highlightRoutes = require('./routes/highlight.routes');
const discussionRoutes = require('./routes/discussion.routes');
const karmaRoutes    = require('./routes/karma.routes');
const bountyRoutes   = require('./routes/bounty.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const verifyRoutes   = require('./routes/verify.routes');
const moderateRoutes = require('./routes/moderate.routes');
const chatRoutes     = require('./routes/chat.routes');   // ← Phase 7: AI chatbot
const examRoutes     = require('./routes/exam.routes');   // ← Use Cases 4.0 & 5.0: Exam Sections

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security & Parsing Middleware ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.SUPABASE_URL || '', 'https://api.openai.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for PDF.js
}));

app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTPS redirect (production only) ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ── Request Logger ─────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[API CALL ⚡] ${req.method} ${req.url}`);
  next();
});
app.use(morgan('dev'));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/syllabus',   syllabusRoutes);
app.use('/api/resources',  resourceRoutes);
app.use('/api/highlights', highlightRoutes);
app.use('/api/discussions',discussionRoutes);
app.use('/api/karma',      karmaRoutes);
app.use('/api/bounties',   bountyRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/verify',     verifyRoutes);
app.use('/api/moderate',   moderateRoutes);
app.use('/api/chat',       chatRoutes);               // ← Phase 7: AI chatbot
app.use('/api/exam',       examRoutes);               // ← Use Cases 4.0 & 5.0

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    ai: process.env.OPENAI_API_KEY ? 'openai' : 'rule-based',
  });
});

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`💥 Unhandled error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 NoteFlow API running on http://localhost:${PORT}`);
  console.log(`🤖 Chatbot: ${process.env.OPENAI_API_KEY ? 'OpenAI GPT-3.5-turbo' : 'Rule-based FAQ fallback'}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
