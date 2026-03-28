-- ============================================================
-- Migration 002: Syllabus & Resources Schema
-- ============================================================

-- ── Syllabus (top-level per classroom) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS syllabus (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id  UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES users(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (classroom_id)
);

-- ── Syllabus Nodes (units / topics) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syllabus_nodes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  syllabus_id   UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
  node_type     TEXT NOT NULL CHECK (node_type IN ('unit', 'topic', 'subtopic')),
  title         TEXT NOT NULL,
  order_index   INT NOT NULL DEFAULT 0,
  has_resources BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_syllabus ON syllabus_nodes(syllabus_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON syllabus_nodes(parent_id);

-- ── Resources (files attached to syllabus nodes) ──────────────────────────────
CREATE TABLE IF NOT EXISTS resources (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  syllabus_node_id UUID NOT NULL REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
  classroom_id     UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  uploader_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_type        TEXT,
  metadata         JSONB DEFAULT '{}'::jsonb,
  version          INT DEFAULT 1,
  is_verified      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_node ON resources(syllabus_node_id);
CREATE INDEX IF NOT EXISTS idx_resources_classroom ON resources(classroom_id);
CREATE INDEX IF NOT EXISTS idx_resources_uploader ON resources(uploader_id);

-- ── Auto-update syllabus updated_at ──────────────────────────────────────────
DROP TRIGGER IF EXISTS update_syllabus_updated_at ON syllabus;
CREATE TRIGGER update_syllabus_updated_at
  BEFORE UPDATE ON syllabus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Auto-update has_resources flag on syllabus_nodes ────────────────────────
CREATE OR REPLACE FUNCTION update_node_has_resources()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE syllabus_nodes SET has_resources = TRUE WHERE id = NEW.syllabus_node_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE syllabus_nodes
    SET has_resources = EXISTS (SELECT 1 FROM resources WHERE syllabus_node_id = OLD.syllabus_node_id)
    WHERE id = OLD.syllabus_node_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_has_resources_insert ON resources;
CREATE TRIGGER trg_update_has_resources_insert
  AFTER INSERT ON resources
  FOR EACH ROW EXECUTE FUNCTION update_node_has_resources();

DROP TRIGGER IF EXISTS trg_update_has_resources_delete ON resources;
CREATE TRIGGER trg_update_has_resources_delete
  AFTER DELETE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_node_has_resources();
