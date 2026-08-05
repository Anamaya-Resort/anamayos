-- ══════════════════════════════════════════════════════════════
-- 00048 — Slice 0-5 audit fixes
--
-- Three problems this migration exists to solve:
--
-- 1. The Scan Theater ordered its feed by `id` (a random uuid), so
--    it showed a frozen, arbitrary 40 assets and newly-tagged media
--    never appeared. There was no "when was this analyzed" column to
--    order by. `analyzed_at` / `proxied_at` fix that and also give
--    the library a real "recently processed" axis.
--
-- 2. Assets that fail analysis were reset from 'error' to 'pending'
--    on EVERY worker boot, so a permanently-bad file re-billed a
--    vision call after every Railway redeploy, forever. Attempt
--    counters bound the retries.
--
-- 3. Worker liveness was invisible from the app. The worker has a
--    history of silently not booting; the UI could not tell "nothing
--    to do" from "the worker is dead". One heartbeat row fixes that
--    without the write volume of logging a row a minute.
-- ══════════════════════════════════════════════════════════════

-- 1. Processing timestamps -------------------------------------
ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS proxied_at timestamptz;

-- Backfill so existing tagged media has a sane order instead of
-- all-null (which would sort arbitrarily). created_at is the best
-- available proxy for "when did this enter the pipeline".
UPDATE video_assets
SET analyzed_at = created_at
WHERE analysis_status = 'done' AND analyzed_at IS NULL;

UPDATE video_assets
SET proxied_at = created_at
WHERE proxy_status = 'done' AND proxied_at IS NULL;

-- The Scan Theater feed: newest-analyzed first, per org.
CREATE INDEX IF NOT EXISTS idx_va_analyzed_at
  ON video_assets (org_id, analyzed_at DESC)
  WHERE analysis_status = 'done';

-- 2. Bounded retries -------------------------------------------
ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS analysis_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proxy_attempts int NOT NULL DEFAULT 0;

-- 3. Worker heartbeat ------------------------------------------
-- Exactly one row (id = true). The worker upserts it every minute;
-- the app reads it to show an "offline" warning instead of an
-- infinite, unexplained "waiting…" spinner.
CREATE TABLE IF NOT EXISTS video_worker_heartbeat (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  beat_at timestamptz NOT NULL DEFAULT now(),
  worker_name text
);

ALTER TABLE video_worker_heartbeat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON video_worker_heartbeat;
CREATE POLICY "Service role full access" ON video_worker_heartbeat
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Duplicate-detection sanity --------------------------------
-- findExactDuplicate could mark BOTH copies of an identical pair as
-- a duplicate of the other (mutual reference, no canonical row).
-- The worker fix only considers already-processed, earlier rows;
-- this clears any mutual pairs the old logic already wrote so the
-- library's "possible duplicates" filter stops double-counting.
UPDATE video_assets a
SET duplicate_of = NULL, duplicate_status = NULL
FROM video_assets b
WHERE a.duplicate_of = b.id
  AND b.duplicate_of = a.id
  AND a.created_at <= b.created_at;
