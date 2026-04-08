-- ============================================================
-- Migration 009: Exam Sections & Revision Tests
-- Use Case 4.0: Upload Exam Resources to Exam Section
-- Use Case 5.0: Take Revision Test
-- ============================================================

-- ── Exam Sections (Midterm / Endterm per classroom) ───────────────────────────
CREATE TABLE IF NOT EXISTS exam_sections (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  exam_type    TEXT NOT NULL CHECK (exam_type IN ('midterm', 'endterm')),
  title        TEXT NOT NULL DEFAULT '',
  description  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (classroom_id, exam_type)
);

CREATE INDEX IF NOT EXISTS idx_exam_sections_classroom ON exam_sections(classroom_id);

-- ── Exam Resources (PYQs, Important Qs, Quick Revision) ──────────────────────
CREATE TABLE IF NOT EXISTS exam_resources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_section_id UUID NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE,
  classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  uploader_id     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_type       TEXT NOT NULL,
  file_size       BIGINT DEFAULT 0,
  resource_type   TEXT NOT NULL DEFAULT 'pyq'
                    CHECK (resource_type IN ('pyq', 'important_questions', 'quick_revision', 'other')),
  year            INT,
  topic_coverage  TEXT,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  reject_reason   TEXT,
  download_count  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_resources_section ON exam_resources(exam_section_id);
CREATE INDEX IF NOT EXISTS idx_exam_resources_classroom ON exam_resources(classroom_id);
CREATE INDEX IF NOT EXISTS idx_exam_resources_status ON exam_resources(status);
CREATE INDEX IF NOT EXISTS idx_exam_resources_uploader ON exam_resources(uploader_id);

-- ── Revision Tests ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revision_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_section_id UUID NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE,
  classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  duration_mins   INT NOT NULL DEFAULT 30 CHECK (duration_mins > 0),
  total_questions INT NOT NULL DEFAULT 10,
  max_attempts    INT NOT NULL DEFAULT 3,
  topics_covered  TEXT[],
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_tests_section ON revision_tests(exam_section_id);
CREATE INDEX IF NOT EXISTS idx_revision_tests_classroom ON revision_tests(classroom_id);

-- ── Test Questions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id     UUID NOT NULL REFERENCES revision_tests(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {id, text}
  correct_opt TEXT NOT NULL,                        -- id of correct option
  explanation TEXT,
  order_num   INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_questions_test ON test_questions(test_id);

-- ── Test Attempts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_attempts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id        UUID NOT NULL REFERENCES revision_tests(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {question_id: selected_option_id}
  score          INT NOT NULL DEFAULT 0,
  total_possible INT NOT NULL DEFAULT 0,
  percentage     NUMERIC(5,2) NOT NULL DEFAULT 0,
  time_taken_sec INT,
  status         TEXT NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned')),
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_student ON test_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON test_attempts(status);

-- Auto-update triggers
DROP TRIGGER IF EXISTS update_exam_sections_updated_at ON exam_sections;
CREATE TRIGGER update_exam_sections_updated_at
  BEFORE UPDATE ON exam_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exam_resources_updated_at ON exam_resources;
CREATE TRIGGER update_exam_resources_updated_at
  BEFORE UPDATE ON exam_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_revision_tests_updated_at ON revision_tests;
CREATE TRIGGER update_revision_tests_updated_at
  BEFORE UPDATE ON revision_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
