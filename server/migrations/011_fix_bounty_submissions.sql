-- ============================================================
-- Migration 011: Fix bounty_submissions missing columns
-- Adds reviewed_by and reviewed_at if they don't already exist
-- ============================================================

ALTER TABLE bounty_submissions
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;
