-- ============================================================
-- Migration 004: Heatmaps & Discussions
-- ============================================================

-- ── Highlights (individual user text selections) ───────────────────────────────
CREATE TABLE IF NOT EXISTS highlights (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id   UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_number   INT NOT NULL,
  coordinates   JSONB NOT NULL,
  -- format: { x1, y1, x2, y2 } normalized 0-1 relative to page dimensions
  text_content  TEXT,
  color         TEXT DEFAULT '#facc15',  -- yellow default
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_resource ON highlights(resource_id);
CREATE INDEX IF NOT EXISTS idx_highlights_resource_page ON highlights(resource_id, page_number);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);

-- ── Heatmap Data (aggregated per page, cached) ────────────────────────────────
CREATE TABLE IF NOT EXISTS heatmap_data (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id      UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  page_number      INT NOT NULL,
  aggregated_zones JSONB DEFAULT '[]'::jsonb,
  -- format: array of { x, y, width, height, intensity (0-100) }
  last_calculated  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (resource_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_heatmap_resource ON heatmap_data(resource_id);

-- ── Discussions (threaded comments per resource) ───────────────────────────────
CREATE TABLE IF NOT EXISTS discussions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id  UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES discussions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  page_number  INT,
  position     JSONB,  -- optional {x, y} for anchored discussions
  resolved     BOOLEAN DEFAULT FALSE,
  pinned       BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussions_resource ON discussions(resource_id);
CREATE INDEX IF NOT EXISTS idx_discussions_parent ON discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussions_user ON discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_page ON discussions(resource_id, page_number);

-- ── Discussion Votes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discussion_votes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discussion_id  UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type      TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (discussion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_discussion ON discussion_votes(discussion_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON discussion_votes(user_id);

-- ── Auto-update discussions.updated_at ────────────────────────────────────────
DROP TRIGGER IF EXISTS update_discussions_updated_at ON discussions;
CREATE TRIGGER update_discussions_updated_at
  BEFORE UPDATE ON discussions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
