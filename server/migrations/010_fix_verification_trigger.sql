-- Migration 010: Fix verification_queue trigger
-- The classroom_id column in verification_queue (if NOT NULL) causes upload failures.
-- This migration makes classroom_id nullable or adds it properly, and fixes the trigger
-- to pull classroom_id from the resources table.

-- Step 1: Add classroom_id to verification_queue if it doesn't exist (nullable)
ALTER TABLE verification_queue
  ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE;

-- Step 2: Drop the old trigger and function
DROP TRIGGER IF EXISTS trg_enqueue_verification ON resources;
DROP FUNCTION IF EXISTS enqueue_for_verification();

-- Step 3: Recreate the function to include classroom_id from the inserted resource row
CREATE OR REPLACE FUNCTION enqueue_for_verification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO verification_queue (resource_id, classroom_id)
  VALUES (NEW.id, NEW.classroom_id)
  ON CONFLICT (resource_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate the trigger
CREATE TRIGGER trg_enqueue_verification
  AFTER INSERT ON resources
  FOR EACH ROW EXECUTE FUNCTION enqueue_for_verification();
