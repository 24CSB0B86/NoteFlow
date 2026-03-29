-- ============================================================
-- Migration 006: Analytics & Moderation System
-- ============================================================

-- ── Analytics Events (tracks all user interactions) ───────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'view','download','upload','discussion_post','highlight','bounty_create',
    'bounty_claim','bounty_fulfill','login','search'
  )),
  resource_id  UUID REFERENCES resources(id) ON DELETE SET NULL,
  metadata     JSONB DEFAULT '{}'::jsonb,  -- duration, search_terms, etc.
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_classroom ON analytics_events(classroom_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_resource ON analytics_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- ── Verification Queue ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_queue (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id  UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE UNIQUE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewer_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  decision_at  TIMESTAMPTZ,
  reject_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_verif_queue_status ON verification_queue(status);
CREATE INDEX IF NOT EXISTS idx_verif_queue_resource ON verification_queue(resource_id);

-- ── Moderation Logs (immutable audit trail) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN (
    'verify','reject_resource','delete_resource','restore_resource',
    'flag_user','unflag_user','delete_discussion','restrict_user'
  )),
  target_type  TEXT NOT NULL CHECK (target_type IN ('resource','user','discussion','bounty')),
  target_id    UUID NOT NULL,
  reason       TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_logs_classroom ON moderation_logs(classroom_id);
CREATE INDEX IF NOT EXISTS idx_mod_logs_moderator ON moderation_logs(moderator_id);
CREATE INDEX IF NOT EXISTS idx_mod_logs_created ON moderation_logs(created_at DESC);

-- ── Soft-delete support on resources ──────────────────────────────────────────
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS is_deleted    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS view_count    INT DEFAULT 0;

-- ── Soft-delete on discussions ────────────────────────────────────────────────
ALTER TABLE discussions
  ADD COLUMN IF NOT EXISTS is_deleted    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_helpful    BOOLEAN DEFAULT FALSE;

-- ── User flags (for moderation) ───────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_flagged       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_restricted    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason      TEXT;

-- ── Auto-enqueue resources for verification on upload ─────────────────────────
CREATE OR REPLACE FUNCTION enqueue_for_verification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO verification_queue (resource_id)
  VALUES (NEW.id)
  ON CONFLICT (resource_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enqueue_verification ON resources;
CREATE TRIGGER trg_enqueue_verification
  AFTER INSERT ON resources
  FOR EACH ROW EXECUTE FUNCTION enqueue_for_verification();
