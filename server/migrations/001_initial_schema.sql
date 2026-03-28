-- ============================================================
-- Migration 001: Initial Schema
-- NoteFlow – users, classrooms, classroom_members
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('professor', 'student')),
  university_email  TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ── Classrooms ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classrooms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  section       TEXT NOT NULL,
  professor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code   TEXT UNIQUE NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classrooms_professor ON classrooms(professor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classrooms_invite_code ON classrooms(invite_code);

-- ── Classroom Members ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classroom_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id  UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (classroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_classroom ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON classroom_members(user_id);

-- ── Auto-update updated_at trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
