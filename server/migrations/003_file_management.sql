-- ============================================================
-- Migration 003: File Management – Versions & Metadata
-- ============================================================

-- ── Extend resources with processing status ───────────────────────────────────
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
  ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count INT DEFAULT 0;

-- ── File Versions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version_number  INT NOT NULL DEFAULT 1,
  file_path       TEXT NOT NULL,     -- Supabase Storage path (bucket/path)
  thumbnail_path  TEXT,              -- thumbnails bucket
  preview_path    TEXT,              -- previews bucket
  file_size       BIGINT DEFAULT 0,
  is_current      BOOLEAN DEFAULT FALSE,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_versions_resource ON file_versions(resource_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_current ON file_versions(resource_id, is_current);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_versions_current_one
  ON file_versions(resource_id) WHERE is_current = TRUE;

-- ── File Metadata ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_metadata (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id  UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE UNIQUE,
  doc_type     TEXT DEFAULT 'other'
                 CHECK (doc_type IN ('handwritten','typed','ppt','image','video','other')),
  year         INT,
  tags         JSONB DEFAULT '[]'::jsonb,
  description  TEXT,
  page_count   INT,
  author       TEXT,
  pdf_title    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_metadata_resource ON file_metadata(resource_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_type ON file_metadata(doc_type);
CREATE INDEX IF NOT EXISTS idx_file_metadata_year ON file_metadata(year);

-- ── Full-text search indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_resources_fts
  ON resources USING GIN (to_tsvector('english', coalesce(file_name, '')));

CREATE INDEX IF NOT EXISTS idx_file_metadata_fts
  ON file_metadata USING GIN (to_tsvector('english',
    coalesce(description, '') || ' ' || coalesce(pdf_title, '') || ' ' || coalesce(author, '')));

-- ── Function: get next version number ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_next_version(p_resource_id UUID)
RETURNS INT AS $$
DECLARE
  max_version INT;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO max_version
  FROM file_versions WHERE resource_id = p_resource_id;
  RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql;
