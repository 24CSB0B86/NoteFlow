-- Migration 007: Add missing columns to user_karma table
ALTER TABLE user_karma
  ADD COLUMN IF NOT EXISTS login_streak    INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login      DATE,
  ADD COLUMN IF NOT EXISTS weekly_points   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_points  INTEGER   NOT NULL DEFAULT 0;
