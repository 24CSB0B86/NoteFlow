require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const classroomRoutes = require('./routes/classroom.routes');
const syllabusRoutes = require('./routes/syllabus.routes');
const resourceRoutes = require('./routes/resource.routes');
const highlightRoutes = require('./routes/highlight.routes');
const discussionRoutes = require('./routes/discussion.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security & Parsing Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request/Response Logger (always print to terminal as required) ─────────────
app.use(morgan((tokens, req, res) => {
  const status = tokens.status(req, res);
  const method = tokens.method(req, res);
  const url = tokens.url(req, res);
  const time = tokens['response-time'](req, res);
  const statusEmoji = status >= 500 ? '❌' : status >= 400 ? '⚠️ ' : '✅';
  return `${statusEmoji}  ${method} ${url} → ${status} [${time}ms]`;
}));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/highlights', highlightRoutes);
app.use('/api/discussions', discussionRoutes);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.log(`❓ Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`💥 Unhandled error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 NoteFlow API running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
