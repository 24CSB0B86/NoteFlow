# NoteFlow 📚

An educational resource sharing platform for professors and students.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| UI | shadcn/ui + Tailwind CSS |
| Backend | Node.js + Express |
| Database | Neon DB (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |

## Project Structure

```
noteflow/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express backend
├── package.json     # Root workspace config
└── README.md
```

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd noteflow
npm install
```

### 2. Configure Environment Variables

```bash
# Client
cp client/.env.example client/.env.local

# Server
cp server/.env.example server/.env
```

Fill in your Supabase and Neon DB credentials (see `.env.example` files).

### 3. Set Up the Database

Run the SQL migration in your Neon DB console:

```bash
# Copy and paste the contents of server/migrations/001_initial_schema.sql
# into your Neon DB SQL editor and execute it.
```

### 4. Run the Application

```bash
# Run both client and server concurrently
npm run dev

# Or run separately:
npm run dev:client   # Frontend at http://localhost:5173
npm run dev:server   # Backend  at http://localhost:3001
```

## Environment Variables

### Client (`client/.env.local`)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_API_URL` | Express backend URL (default: `http://localhost:3001`) |

### Server (`server/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon DB PostgreSQL connection string |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (keep secret!) |
| `PORT` | Server port (default: `3001`) |
| `CLIENT_URL` | Frontend URL for CORS (default: `http://localhost:5173`) |

## Deployment

- **Frontend**: Deploy `client/` to Vercel
- **Backend**: Deploy `server/` to Render or Railway
- Update environment variables in your hosting dashboards accordingly.
