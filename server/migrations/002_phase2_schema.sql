-- ============================================================
-- NoteFlow - Phase 2 Schema: Syllabus, Nodes & Resources
-- Run this in your Neon DB SQL Editor AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- DROP PLACEHOLDER RESOURCES TABLE FROM PHASE 1
-- ============================================================
DROP TABLE IF EXISTS resources CASCADE;

-- ============================================================
-- SYLLABUS TABLE
-- One syllabus per classroom (created lazily on first access)
-- ============================================================
CREATE TABLE IF NOT EXISTS syllabus (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_syllabus_classroom UNIQUE (classroom_id)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_classroom_id ON syllabus(classroom_id);

-- Auto-update updated_at on syllabus
CREATE TRIGGER syllabus_updated_at
  BEFORE UPDATE ON syllabus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SYLLABUS NODES TABLE
-- Self-referential tree: units → topics → sub-topics
-- ============================================================
CREATE TABLE IF NOT EXISTS syllabus_nodes (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  syllabus_id  UUID    NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
  parent_id    UUID    REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
  node_type    TEXT    NOT NULL CHECK (node_type IN ('unit', 'topic', 'subtopic')),
  title        TEXT    NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  has_resources BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syllabus_nodes_syllabus_id ON syllabus_nodes(syllabus_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_nodes_parent_id   ON syllabus_nodes(parent_id);

CREATE TRIGGER syllabus_nodes_updated_at
  BEFORE UPDATE ON syllabus_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RESOURCES TABLE (Full Phase 2 definition)
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  syllabus_node_id UUID REFERENCES syllabus_nodes(id) ON DELETE SET NULL,
  classroom_id     UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  uploader_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_type        TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  version          INTEGER NOT NULL DEFAULT 1,
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_classroom_id     ON resources(classroom_id);
CREATE INDEX IF NOT EXISTS idx_resources_uploader_id      ON resources(uploader_id);
CREATE INDEX IF NOT EXISTS idx_resources_syllabus_node_id ON resources(syllabus_node_id);
CREATE INDEX IF NOT EXISTS idx_resources_file_type        ON resources(file_type);

-- ============================================================
-- Automatically update has_resources flag on syllabus_nodes
-- when a resource is inserted/deleted
-- ============================================================
CREATE OR REPLACE FUNCTION sync_node_has_resources()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.syllabus_node_id IS NOT NULL THEN
    UPDATE syllabus_nodes SET has_resources = TRUE WHERE id = NEW.syllabus_node_id;
  ELSIF TG_OP = 'DELETE' AND OLD.syllabus_node_id IS NOT NULL THEN
    UPDATE syllabus_nodes
    SET has_resources = EXISTS (
      SELECT 1 FROM resources WHERE syllabus_node_id = OLD.syllabus_node_id
    )
    WHERE id = OLD.syllabus_node_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resources_sync_has_resources
  AFTER INSERT OR DELETE ON resources
  FOR EACH ROW EXECUTE FUNCTION sync_node_has_resources();

-- ============================================================
-- SAMPLE JSONB metadata structure (for reference):
-- {
--   "description": "Lecture notes for Week 1",
--   "tags": ["intro", "week1"],
--   "file_size_bytes": 204800,
--   "original_name": "week1_notes.pdf"
-- }
-- ============================================================
