-- ============================================================
-- Migration 013: Add missing description column to karma_transactions
-- The column was defined in 005_bounty_karma.sql but the table
-- was created before that column was added to the schema.
-- ============================================================

ALTER TABLE karma_transactions
  ADD COLUMN IF NOT EXISTS description TEXT;
