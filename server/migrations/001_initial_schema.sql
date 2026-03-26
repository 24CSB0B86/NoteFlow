-- ============================================================
-- NoteFlow - Initial Database Schema
-- Run this in your Neon DB SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Supabase Auth user ID (links to auth.users)
  auth_id     UUID UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('professor', 'student')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast auth lookup
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CLASSROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS classrooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  section      TEXT,
  description  TEXT,
  professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code  TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classrooms_professor_id ON classrooms(professor_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_invite_code  ON classrooms(invite_code);

-- ============================================================
-- CLASSROOM MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS classroom_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure a user can only join a classroom once
  CONSTRAINT uq_classroom_member UNIQUE (classroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom_id ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_user_id      ON classroom_members(user_id);

-- ============================================================
-- RESOURCES TABLE (placeholder for Phase 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  uploaded_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  file_url     TEXT NOT NULL,
  file_type    TEXT,
  file_size    BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_classroom_id ON resources(classroom_id);
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by  ON resources(uploaded_by);
