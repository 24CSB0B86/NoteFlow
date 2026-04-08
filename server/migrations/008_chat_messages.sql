-- Migration 008: Chat Messages Table
-- Stores AI chatbot conversation history per user

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT        NOT NULL,
  -- optional: which classroom the user was viewing when asking
  classroom_id UUID       REFERENCES classrooms(id) ON DELETE SET NULL,
  -- rating: null = not rated, true = thumbs up, false = thumbs down
  rating      BOOLEAN     DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(user_id, created_at DESC);

-- Optional: auto-purge messages older than 90 days (run as cron or manually)
-- DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '90 days';
