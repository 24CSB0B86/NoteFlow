# NoteFlow Setup Instructions 🚀

Complete guide to get NoteFlow running locally and deploying to production.

---

## ✅ Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | any | `git --version` |

---

## 1. Clone & Install

```bash
git clone https://github.com/your-username/NoteFlow.git
cd NoteFlow

# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

---

## 2. Database Setup (Neon DB — Free)

1. Go to [console.neon.tech](https://console.neon.tech) → Create account → New Project
2. Copy the **Connection String** (pooled version)  
   Format: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
3. Paste it as `DATABASE_URL` in `server/.env`

**Run migrations:**
```bash
cd server
node run-migrations.js
```

This creates all 8 tables: users, classrooms, resources, highlights, discussions, bounties, karma_events, chat_messages.

---

## 3. Supabase Setup (Free — Storage)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Once created, go to **Settings → API**:
   - Copy **Project URL** → `SUPABASE_URL` in `server/.env` and `VITE_SUPABASE_URL` in `client/.env`
   - Copy **anon/public key** → `VITE_SUPABASE_ANON_KEY` in `client/.env`
   - Copy **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`
3. Create a storage bucket named **`resources`** (public):
   - Go to **Storage → New Bucket** → name it `resources` → check Public
   - Run the SQL in `supabase_bucket_setup.sql` in the Supabase SQL Editor

---

## 4. Configure Environment Files

### `server/.env`
```env
DATABASE_URL=postgresql://...your-neon-url...?sslmode=require
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=your-random-32-char-secret
OPENAI_API_KEY=sk-proj-...   # Optional — leave blank for FAQ fallback
GMAIL_USER=your@gmail.com    # Optional — for email notifications
GMAIL_APP_PASS=xxxx xxxx xxxx xxxx  # Optional — Gmail App Password
EMAIL_FROM=your@gmail.com    # Optional
```

### `client/.env`
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

> ⚠️ **NEVER commit .env files.** They are in `.gitignore`.

---

## 5. AI Chatbot Setup (Optional but Recommended)

The chatbot works **without any setup** using built-in FAQ rules.

**To enable GPT-3.5-turbo AI responses:**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to `server/.env`:
   ```
   OPENAI_API_KEY=sk-proj-...your-key
   OPENAI_MODEL=gpt-3.5-turbo
   OPENAI_MAX_TOKENS=500
   ```
4. Restart the server

Check the health endpoint to confirm: `GET http://localhost:3001/api/health`  
→ `{ "ai": "openai" }` means GPT is active, `"rule-based"` means fallback.

---

## 6. Email Setup (Optional)

For email notifications (resource approved, bounty claimed):

**Gmail App Password:**
1. Enable 2FA on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)  
3. Generate an App Password for "Mail"
4. Add to `server/.env`:
   ```
   GMAIL_USER=your@gmail.com
   GMAIL_APP_PASS=xxxx xxxx xxxx xxxx
   EMAIL_FROM=your@gmail.com
   ```

---

## 7. Start Development Servers

Open **two terminals:**

```bash
# Terminal 1 — Backend API
cd server
npm run dev
# → Running at http://localhost:3001

# Terminal 2 — Frontend
cd client
npm run dev
# → Running at http://localhost:5173
```

---

## 8. Running Tests

```bash
# Server tests (Jest + Supertest — no DB needed, uses mocks)
cd server && npm test

# Client tests (Vitest + React Testing Library)
cd client && npm test
```

> Tests do NOT require a real database. The DB is fully mocked.  
> Tests also do NOT hit the OpenAI API (mocked in test suite).

---

## 9. Production Deployment

### Frontend → Vercel (Free)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Git Repository
3. **Root Directory:** `client`
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Set **Environment Variables:**
   ```
   VITE_API_URL=https://your-render-url.onrender.com
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```
7. Click **Deploy**

### Backend → Render (Free)

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub repository
3. Settings:
   - **Name:** `noteflow-api`
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Set **Environment Variables** (from `render.yaml` for the complete list):
   ```
   NODE_ENV=production
   DATABASE_URL=...   (from Neon DB)
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   JWT_SECRET=...     (min 32 chars)
   CLIENT_URL=...     (your Vercel URL)
   OPENAI_API_KEY=... (optional)
   ```
5. Click **Create Web Service**

**Important:** After Render gives you a URL (e.g. `https://noteflow-api.onrender.com`), update `vercel.json`:
```json
"dest": "https://noteflow-api.onrender.com/api/$1"
```
Then redeploy on Vercel.

---

## 10. CI/CD Pipeline (GitHub Actions)

The `.github/workflows/ci.yml` runs automatically on every push/PR:
- ✅ Server tests (Jest)
- ✅ Client tests (Vitest)
- ✅ Production build verification
- ✅ ESLint check

No setup needed — just push to GitHub.

---

## ⚠️ Things That Might Fall Short (Known Limitations)

| Issue | Notes |
|-------|-------|
| **Render free tier cold starts** | First request after 15min idle takes ~30s. Upgrade to paid to avoid this. |
| **OpenAI free credits** | GPT-3.5-turbo free tier has limited credits. The **FAQ fallback works without any key**. |
| **Supabase 50MB file limit** | Free tier limits file uploads to 50MB per file. Large PDFs may need compression. |
| **Neon DB 0.5GB storage** | Free tier limit. Monitor usage in Neon console. |
| **Redis caching** | `REDIS_URL` is optional. Without it, responses are not cached (still works fine for dev). |
| **Email delivery** | Gmail may rate-limit. For production, use SendGrid or Resend free tiers. |
| **HTTPS on localhost** | Tests run over HTTP. Production gets HTTPS via Vercel/Render automatically. |

---

## 🆘 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Cannot find module '../config/db'` | Run `npm install` in `server/` |
| `Invalid token` on API calls | Check `JWT_SECRET` is set in `server/.env` |
| `CORS error` in browser | Check `CLIENT_URL` in `server/.env` matches your frontend URL |
| `relation does not exist` DB error | Run `node run-migrations.js` in `server/` |
| Chat widget not appearing | Ensure you're on a protected route (logged in) — ChatWidget is inside Layout |
| `OPENAI_KEY` not working | Key may have expired or have no credits — chatbot auto-falls back to FAQ |
| Vitest tests failing | Run `npm install` in `client/` to get the new test dependencies |
| Jest tests failing | Run `npm install` in `server/` to get Jest + Supertest |

---

## 📞 Support

- Check existing issues on GitHub
- Review logs: `npm run dev` shows all API calls in the terminal
- Health check: `curl http://localhost:3001/api/health`
