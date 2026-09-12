-- ══════════════════════════════════════════════════════════════
-- 00058 - A source can come from somewhere other than Google Drive
--
-- The pipeline after inventory - thumbnails, tagging, review,
-- galleries - never cared where a file came from. Only the crawl and
-- the download do. So a provider column plus a couple of nullable
-- fields is the whole change; nothing downstream moves.
--
-- content_hash is deliberately separate from drive_md5_checksum:
-- Dropbox hashes differently (block-based SHA-256, not MD5), so the
-- two cannot be compared. Cross-provider duplicates are caught by
-- name and size first, then confirmed by MD5 once the bytes are in
-- hand - which still saves the expensive part, the vision call.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE video_drive_sources
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google_drive'
    CHECK (provider IN ('google_drive', 'dropbox')),
  ADD COLUMN IF NOT EXISTS shared_link text;

-- connection_id is meaningless for a Dropbox shared link: there is no
-- per-account connection row, just an app token in the environment.
ALTER TABLE video_drive_sources
  ALTER COLUMN connection_id DROP NOT NULL;

ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google_drive',
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_va_content_hash
  ON video_assets (org_id, content_hash)
  WHERE content_hash IS NOT NULL;

-- Name plus exact byte size: the pre-download check for a file that
-- already exists under another provider, where the hashes cannot be
-- compared directly.
CREATE INDEX IF NOT EXISTS idx_va_name_size
  ON video_assets (org_id, file_name, size_bytes)
  WHERE is_deleted_on_drive = false;

COMMENT ON COLUMN video_assets.content_hash IS
  'Provider-native hash. Dropbox content_hash; null for Drive, which uses drive_md5_checksum. Not comparable between providers.';

-- Extend duplicate flagging to match on name+size as well as MD5, so a
-- copy arriving from a different provider is caught before it is
-- downloaded rather than after.
CREATE OR REPLACE FUNCTION flag_duplicate_assets(p_org_id uuid)
RETURNS TABLE (flagged int)
LANGUAGE plpgsql
AS $$
DECLARE
  n int;
  m int;
BEGIN
  -- 1. Same bytes, same provider: exact hash match.
  WITH canonical AS (
    SELECT DISTINCT ON (coalesce(drive_md5_checksum, content_hash))
           id, coalesce(drive_md5_checksum, content_hash) AS h
    FROM video_assets
    WHERE org_id = p_org_id
      AND coalesce(drive_md5_checksum, content_hash) IS NOT NULL
      AND is_deleted_on_drive = false
    ORDER BY coalesce(drive_md5_checksum, content_hash),
             (proxy_status = 'done') DESC, created_at ASC
  )
  UPDATE video_assets a
  SET duplicate_of = c.id, duplicate_status = 'exact',
      proxy_status = 'skipped', analysis_status = 'skipped'
  FROM canonical c
  WHERE a.org_id = p_org_id
    AND coalesce(a.drive_md5_checksum, a.content_hash) = c.h
    AND a.id <> c.id
    AND a.is_deleted_on_drive = false
    AND a.proxy_status IN ('pending', 'error')
    AND a.analysis_status IN ('pending', 'error');
  GET DIAGNOSTICS n = ROW_COUNT;

  -- 2. Same name and byte-for-byte the same size, on a copy that came
  --    from a different provider. Two distinct photographs sharing a
  --    filename AND an exact byte count is vanishingly unlikely.
  WITH canonical AS (
    SELECT DISTINCT ON (file_name, size_bytes) id, file_name, size_bytes, provider
    FROM video_assets
    WHERE org_id = p_org_id
      AND size_bytes IS NOT NULL
      AND is_deleted_on_drive = false
    ORDER BY file_name, size_bytes, (proxy_status = 'done') DESC, created_at ASC
  )
  UPDATE video_assets a
  SET duplicate_of = c.id, duplicate_status = 'cross_provider',
      proxy_status = 'skipped', analysis_status = 'skipped'
  FROM canonical c
  WHERE a.org_id = p_org_id
    AND a.file_name = c.file_name
    AND a.size_bytes = c.size_bytes
    AND a.provider <> c.provider
    AND a.id <> c.id
    AND a.is_deleted_on_drive = false
    AND a.proxy_status IN ('pending', 'error')
    AND a.analysis_status IN ('pending', 'error');
  GET DIAGNOSTICS m = ROW_COUNT;

  RETURN QUERY SELECT n + m;
END;
$$;
