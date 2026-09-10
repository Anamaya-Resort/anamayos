-- ══════════════════════════════════════════════════════════════
-- 00054 - Favourites
--
-- A single org-wide flag rather than per-user: the collection is a
-- shared working set, and "the good ones" is a team judgement, not a
-- private bookmark list. Any admin can add or remove.
--
-- favorited_at exists so the favourites view can order newest-first
-- like every other view, rather than falling back to when the photo
-- was scanned.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorited_at timestamptz,
  ADD COLUMN IF NOT EXISTS favorited_by uuid;

CREATE INDEX IF NOT EXISTS idx_va_favorite
  ON video_assets (org_id, favorited_at DESC)
  WHERE is_favorite = true;

-- Sorting A-Z on 6,700 rows without this is a full scan every time.
CREATE INDEX IF NOT EXISTS idx_va_filename
  ON video_assets (org_id, file_name)
  WHERE is_deleted_on_drive = false;
