-- ══════════════════════════════════════════════════════════════
-- 00046 — Review + consent state (Slice 4: Staff Review + Privacy)
--
-- video_asset_reviews stays the append-only audit trail of every
-- human decision; video_asset_permissions stays the single
-- current-permission row per asset. These two new columns are
-- DERIVED MIRRORS of "latest review" and "current permission",
-- written in the same request as the decision. They exist so the
-- review inboxes — and the future render permission gate — can
-- filter at the DB level instead of folding append-only history
-- in application code at scale.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS use_permission video_use_permission NOT NULL DEFAULT 'unknown';

-- review_status ∈ pending | approved | rejected (mirror of the
-- newest video_asset_reviews.approval_status for the asset).

CREATE INDEX IF NOT EXISTS idx_va_review
  ON video_assets (org_id, review_status)
  WHERE is_deleted_on_drive = false;

CREATE INDEX IF NOT EXISTS idx_va_perm
  ON video_assets (org_id, use_permission)
  WHERE is_deleted_on_drive = false;

-- Backfill from any pre-existing decisions (no-op on fresh data).
UPDATE video_assets a
SET use_permission = p.use_permission
FROM video_asset_permissions p
WHERE p.asset_id = a.id
  AND a.use_permission = 'unknown'
  AND p.use_permission <> 'unknown';

UPDATE video_assets a
SET review_status = r.approval_status
FROM (
  SELECT DISTINCT ON (asset_id) asset_id, approval_status
  FROM video_asset_reviews
  ORDER BY asset_id, edited_at DESC
) r
WHERE r.asset_id = a.id
  AND a.review_status = 'pending';
