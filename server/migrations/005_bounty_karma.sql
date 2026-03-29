-- ============================================================
-- Migration 005: Bounty Board & Gamification System
-- ============================================================

-- ── Badges (static definitions, seeded once) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '🏅',
  rarity      TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','legendary')),
  criteria    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Karma (one row per user) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_karma (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_points  INT NOT NULL DEFAULT 0,
  level         INT NOT NULL DEFAULT 1,
  last_login    DATE,
  login_streak  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_karma_user ON user_karma(user_id);
CREATE INDEX IF NOT EXISTS idx_user_karma_points ON user_karma(total_points DESC);

-- ── Karma Transactions (immutable append-only ledger) ─────────────────────────
CREATE TABLE IF NOT EXISTS karma_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points       INT NOT NULL,
  action_type  TEXT NOT NULL CHECK (action_type IN (
    'upload','upvote','downvote','bounty_fulfill','bounty_create',
    'discussion_helpful','login_streak','professor_verify',
    'spam_penalty','badge_bonus','manual_adjustment'
  )),
  reference_id UUID,                 -- resource_id / bounty_id / discussion_id etc.
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_karma_tx_user ON karma_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_karma_tx_created ON karma_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_karma_tx_action ON karma_transactions(action_type);

-- ── User Badges (earned badges per user) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id   UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ── Bounties ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bounties (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id     UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  syllabus_node_id UUID REFERENCES syllabus_nodes(id) ON DELETE SET NULL,
  requester_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  points_reward    INT NOT NULL DEFAULT 10 CHECK (points_reward > 0),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','claimed','fulfilled','closed','expired')),
  is_urgent        BOOLEAN DEFAULT FALSE,
  claimer_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at       TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bounties_classroom ON bounties(classroom_id);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
CREATE INDEX IF NOT EXISTS idx_bounties_requester ON bounties(requester_id);
CREATE INDEX IF NOT EXISTS idx_bounties_claimer ON bounties(claimer_id);
CREATE INDEX IF NOT EXISTS idx_bounties_node ON bounties(syllabus_node_id);

-- ── Bounty Submissions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bounty_submissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bounty_id    UUID NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  fulfiller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id  UUID REFERENCES resources(id) ON DELETE SET NULL,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bounty_submissions_bounty ON bounty_submissions(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_fulfiller ON bounty_submissions(fulfiller_id);

-- ── In-App Notifications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,   -- bounty_claimed, bounty_approved, badge_earned, etc.
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,            -- frontend route to navigate to
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- ── Auto-update updated_at triggers ──────────────────────────────────────────
DROP TRIGGER IF EXISTS update_user_karma_updated_at ON user_karma;
CREATE TRIGGER update_user_karma_updated_at
  BEFORE UPDATE ON user_karma
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bounties_updated_at ON bounties;
CREATE TRIGGER update_bounties_updated_at
  BEFORE UPDATE ON bounties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed Badges ───────────────────────────────────────────────────────────────
INSERT INTO badges (name, description, icon, rarity, criteria) VALUES
  ('Getting Started',    'Upload your first resource',                        '🚀', 'common',    '{"type":"upload_count","threshold":1}'),
  ('Contributor',        'Upload 10 resources',                               '📚', 'common',    '{"type":"upload_count","threshold":10}'),
  ('Knowledge Sharer',   'Upload 50 resources',                               '🎓', 'rare',       '{"type":"upload_count","threshold":50}'),
  ('Helper',             'Fulfill your first bounty',                         '🤝', 'common',    '{"type":"bounty_fulfill","threshold":1}'),
  ('Bounty Hunter',      'Fulfill 5 bounties',                                '🏹', 'rare',       '{"type":"bounty_fulfill","threshold":5}'),
  ('Legendary Hunter',   'Fulfill 20 bounties',                               '⚡', 'legendary', '{"type":"bounty_fulfill","threshold":20}'),
  ('Certified',          'Have a resource verified by your professor',         '✅', 'rare',       '{"type":"verified_resource","threshold":1}'),
  ('Popular',            'Receive 50 upvotes on your resources',              '🔥', 'rare',       '{"type":"upvotes_received","threshold":50}'),
  ('Wise One',           'Have 10 discussions marked as helpful',             '🦉', 'legendary', '{"type":"helpful_discussions","threshold":10}'),
  ('Streak Master',      'Maintain a 7-day login streak',                     '📅', 'common',    '{"type":"login_streak","threshold":7}'),
  ('Legend',             'Reach Level 5 (1000+ karma points)',                '👑', 'legendary', '{"type":"level","threshold":5}')
ON CONFLICT (name) DO NOTHING;
