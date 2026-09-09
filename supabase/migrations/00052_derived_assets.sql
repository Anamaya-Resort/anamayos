-- ══════════════════════════════════════════════════════════════
-- 00052 - Enlarged copies live in the gallery, not in Downloads
--
-- Enlarging handed the file back as a browser download, which put the
-- result outside the library that exists to hold it. An enlarged photo
-- is a library asset like any other; it just was not scanned from
-- Drive.
--
-- original_path also serves the originals-archive work in the roadmap:
-- it is where a full-resolution file lives when we hold one, as
-- opposed to the 1280px proxy the grid serves.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS original_path text,
  ADD COLUMN IF NOT EXISTS derived_from uuid REFERENCES video_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS derived_kind text;

COMMENT ON COLUMN video_assets.original_path IS
  'Full-resolution file in the video-proxies bucket, when one is held. Null means Drive is still the only copy.';
COMMENT ON COLUMN video_assets.derived_from IS
  'The asset this was made from. Set for enlargements and any future crops or edits.';
COMMENT ON COLUMN video_assets.derived_kind IS
  'How it was derived, e.g. upscale_2x. Null for anything scanned from Drive.';

CREATE INDEX IF NOT EXISTS idx_va_derived
  ON video_assets (derived_from) WHERE derived_from IS NOT NULL;
