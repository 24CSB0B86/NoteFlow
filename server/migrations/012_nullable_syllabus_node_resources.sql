-- ============================================================
-- Migration 012: Allow resources without a syllabus node
-- Needed for bounty submissions where no syllabus node is assigned
-- ============================================================

-- Drop NOT NULL constraint so bounty-uploaded resources can have no node
ALTER TABLE resources
  ALTER COLUMN syllabus_node_id DROP NOT NULL;

-- Drop the CASCADE delete so deleting a node doesn't cascade to bounty resources
-- Re-add as SET NULL instead
ALTER TABLE resources
  DROP CONSTRAINT IF EXISTS resources_syllabus_node_id_fkey;

ALTER TABLE resources
  ADD CONSTRAINT resources_syllabus_node_id_fkey
  FOREIGN KEY (syllabus_node_id) REFERENCES syllabus_nodes(id) ON DELETE SET NULL;

-- Fix the has_resources trigger to handle NULL syllabus_node_id safely
CREATE OR REPLACE FUNCTION update_node_has_resources()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.syllabus_node_id IS NOT NULL THEN
      UPDATE syllabus_nodes SET has_resources = TRUE WHERE id = NEW.syllabus_node_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.syllabus_node_id IS NOT NULL THEN
      UPDATE syllabus_nodes
      SET has_resources = EXISTS (SELECT 1 FROM resources WHERE syllabus_node_id = OLD.syllabus_node_id)
      WHERE id = OLD.syllabus_node_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
