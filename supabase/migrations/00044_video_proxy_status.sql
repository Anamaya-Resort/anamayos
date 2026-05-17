-- ============================================================
-- 00044: proxy/thumbnail processing state on video_assets
-- ============================================================
-- Slice 2: the worker downloads each asset, makes a thumbnail +
-- 720p/1280px proxy, perceptual-hashes it, uploads to the
-- video-proxies bucket. proxy_status drives a claim-safe batch
-- loop (pending -> processing -> done|error) so overlapping cron
-- ticks can't double-process the same asset.
-- ============================================================

ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS proxy_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS proxy_error text;

-- only rows that still need a proxy
CREATE INDEX IF NOT EXISTS idx_va_proxy_pending
  ON video_assets (org_id, proxy_status)
  WHERE proxy_status = 'pending' AND is_deleted_on_drive = false;
