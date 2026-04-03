# NoteFlow 📚

> **AI-powered collaborative note-sharing platform for university students and professors.**

[![CI/CD](https://github.com/your-username/NoteFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/NoteFlow/actions)
![Node](https://img.shields.io/badge/Node-20.x-green)
![React](https://img.shields.io/badge/React-18-blue)
![License](https://img.shields.io/badge/license-MIT-purple)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏫 **Classrooms** | Professors create, students join with a 6-char code |
| 📄 **PDF Resources** | Upload, view, annotate, and verify study materials |
| 🔥 **Heatmaps** | Real-time highlight density overlays on PDFs |
| 💬 **Discussions** | Threaded comments anchored to PDF highlights |
| ⭐ **Karma Points** | Reputation system for contributions |
| 🏹 **Bounty Board** | Request and reward specific resources |
| 📊 **Analytics** | Professor dashboard with engagement metrics |
| 🤖 **AI Chatbot** | GPT-3.5-turbo powered assistant (with free FAQ fallback) |
| 🔐 **RBAC Auth** | JWT-based auth with student/professor roles |

---

## 🏗️ Tech Stack

**Frontend:** React 18 · Vite · TailwindCSS · shadcn/ui · react-pdf · Recharts  
**Backend:** Node.js · Express 4 · PostgreSQL (Neon DB) · Supabase Storage  
**AI:** OpenAI GPT-3.5-turbo (with built-in rule-based FAQ fallback)  
**Testing:** Jest + Supertest (server) · Vitest + RTL (client)  
**Deployment:** Vercel (frontend) · Render (backend)  
**CI/CD:** GitHub Actions

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)
- Git

### 1. Clone & Install

```bash
git clone https://github.com/your-username/NoteFlow.git
cd NoteFlow

# Install root workspace deps
npm install

# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### 2. Configure Environment

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env — fill in DATABASE_URL, SUPABASE_URL, JWT_SECRET

# Client
cp client/.env.example client/.env
# Edit client/.env — fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

> See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) for detailed service setup.

### 3. Run Database Migrations

```bash
cd server
node run-migrations.js
```

### 4. Start Development Servers

Open **two terminals**:

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd server && npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing

```bash
# Server tests (Jest + Supertest)
cd server && npm test

# Server tests with coverage
cd server && npm run test:coverage

# Client tests (Vitest + React Testing Library)
cd client && npm test

# Client tests with coverage
cd client && npm run test:coverage
```

Tests mock the database and external APIs — no real network calls in tests.

---

## 📦 Project Structure

```
NoteFlow/
├── .github/
│   └── workflows/ci.yml       # GitHub Actions CI/CD
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   └── ChatWidget.jsx   # 🤖 AI chat floating widget
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── Layout.jsx
│   │   │   └── ...
│   │   ├── pages/              # Route pages
│   │   ├── context/            # React contexts (Auth, Classroom, Syllabus)
│   │   └── lib/                # API client, utils
│   ├── vitest.setup.js
│   └── vite.config.js
├── server/                     # Express API
│   ├── src/
│   │   ├── __tests__/          # Jest test files
│   │   ├── controllers/        # Route handlers
│   │   ├── routes/             # Express routers
│   │   ├── services/           # AI, email, karma, file processing
│   │   ├── middleware/         # Auth, rate limiting, RBAC
│   │   └── index.js            # App entry point
│   └── migrations/             # SQL migration files
├── vercel.json                 # Vercel frontend deployment
├── render.yaml                 # Render backend deployment
└── SETUP_INSTRUCTIONS.md       # Detailed setup guide
```

---

## 🌐 API Reference

Base URL: `http://localhost:3001/api` (dev) / `https://your-api.onrender.com/api` (prod)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Login, get JWT token |
| GET | `/auth/me` | Get current user (requires JWT) |

### Chatbot
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Send message, get AI reply |
| GET | `/chat/history` | Get paginated chat history |
| DELETE | `/chat/history` | Clear all chat history |
| PATCH | `/chat/:id/rate` | Rate a bot message (👍/👎) |

### Classrooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/classrooms` | List user's classrooms |
| POST | `/classrooms` | Create classroom (professor) |
| POST | `/classrooms/join` | Join with class code (student) |

> Full API docs with request/response examples available via health check: `GET /api/health`

---

## 🤖 AI Chatbot

The chatbot works in two modes:

1. **OpenAI Mode** (when `OPENAI_API_KEY` is set) — Uses GPT-3.5-turbo with classroom context injection
2. **FAQ Fallback Mode** (no key needed) — Rule-based answers for common questions about the platform

**Questions the bot can answer:**
- "How do I join a classroom?"
- "What are karma points?"
- "How do heatmaps work?"
- "What is the Bounty Board?"
- "How do I upload a resource?"

---

## 🚀 Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import repo in [vercel.com](https://vercel.com)
3. Set root directory: `client`
4. Set env vars: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Deploy!

### Backend → Render

1. Import repo in [render.com](https://render.com)
2. Create **Web Service** → select repo
3. Build: `cd server && npm install`
4. Start: `cd server && npm start`
5. Set env vars (see `render.yaml` for the full list)

### Update `vercel.json`

After deploying to Render, update the API route in `vercel.json`:
```json
"dest": "https://noteflow-api.onrender.com/api/$1"
```

---

## 🔒 Security

- JWT authentication on all protected routes
- RBAC: professor-only routes enforced via middleware
- Helmet.js security headers (CSP, HSTS, etc.)
- Rate limiting on auth and chat endpoints
- Input validation via express-validator
- SQL injection prevention (parameterized queries via `pg`)
- CORS restricted to known origins
- HTTPS redirect enforced in production

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run tests: `cd server && npm test && cd ../client && npm test`
5. Open a PR against `main`

---

## 📄 License

MIT © NoteFlow Team 2026
