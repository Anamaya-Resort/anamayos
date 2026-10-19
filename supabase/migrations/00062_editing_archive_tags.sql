-- ══════════════════════════════════════════════════════════════
-- 00062 - Archiving, tag browsing, and dropping usage tracking
--
-- Three unrelated gaps found in the audit, plus one removal.
--
-- ARCHIVE. Nothing could ever leave the collection. There was no
-- delete of any kind, and the one flag every query filtered on
-- (is_deleted_on_drive) is never written by anything - so a photo
-- deleted from Drive stayed here forever.
--
-- Archiving rather than deleting, because a row can be referenced by
-- a published gallery and the website reads those live: a hard delete
-- would blank a live page with no warning and no way back. Archived
-- images leave the grid, leave search and leave the counts, and can
-- be restored. Emptying the archive for real is a separate, explicit
-- act.
--
-- TAG BROWSING. 1,445 distinct tags and 87,598 assignments, with no
-- way to see any of them - the only way in was guessing words into
-- the search box. gallery_tag_facets() returns the vocabulary with
-- counts, which is what a keyword list needs.
--
-- USAGE TRACKING. video_asset_usages has existed since the first
-- slice and has never held a row, and nothing reads or writes it.
-- Dropped at the user's instruction.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

-- Partial index: the grid's hot path is "not archived", and all but a
-- handful of rows satisfy it.
CREATE INDEX IF NOT EXISTS idx_va_archived
  ON video_assets (org_id, archived_at) WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN video_assets.archived_at IS
  'Set = out of the library (grid, search, counts) but recoverable. '
  'Never hard-delete a row a published gallery may still reference.';

-- ── Tag vocabulary, with counts ───────────────────────────────
-- File-level tags only (segment_id IS NULL). A video''s per-segment
-- tags describe a moment inside it, not the file, and counting them
-- would report a 6-segment video six times.
CREATE OR REPLACE FUNCTION gallery_tag_facets(
  p_org_id uuid,
  p_category text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_limit int DEFAULT 400
)
RETURNS TABLE (category text, tag text, n bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(t.category, 'other') AS category, t.tag, count(DISTINCT t.asset_id) AS n
  FROM video_asset_tags t
  JOIN video_assets a ON a.id = t.asset_id
  WHERE a.org_id = p_org_id
    AND a.is_deleted_on_drive = false
    AND a.archived_at IS NULL
    AND a.duplicate_of IS NULL
    AND t.segment_id IS NULL
    AND (p_category IS NULL OR t.category = p_category)
    AND (p_q IS NULL OR p_q = '' OR t.tag ILIKE '%' || p_q || '%')
  GROUP BY 1, 2
  ORDER BY n DESC, t.tag ASC
  LIMIT p_limit;
$$;

-- ── Reordering a gallery ──────────────────────────────────────
-- One statement for the whole new order. Done as separate updates it
-- would trip the (gallery_id, asset_id) ordering the strip reads
-- halfway through, and a reorder interrupted in the middle would
-- leave two images claiming the same position.
CREATE OR REPLACE FUNCTION reorder_gallery(
  p_org_id uuid,
  p_gallery_id uuid,
  p_asset_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM video_galleries g
    WHERE g.id = p_gallery_id AND g.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'gallery not found in this org';
  END IF;

  UPDATE video_gallery_items i
  SET sort_order = o.pos
  FROM unnest(p_asset_ids) WITH ORDINALITY AS o(asset_id, pos)
  WHERE i.gallery_id = p_gallery_id AND i.asset_id = o.asset_id;

  UPDATE video_galleries SET updated_at = now() WHERE id = p_gallery_id;
END;
$$;

-- ── Removal ───────────────────────────────────────────────────
DROP TABLE IF EXISTS video_asset_usages;

-- Search and the library must not show archived images.
CREATE OR REPLACE FUNCTION search_assets_page(
  p_org_id uuid,
  p_q text,
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 60,
  p_offset int DEFAULT 0
)
RETURNS TABLE (asset_id uuid, total_count bigint)
LANGUAGE sql
STABLE
AS $$
  WITH matched AS (
    SELECT DISTINCT a.id, a.created_at, a.file_name, a.favorited_at, a.is_favorite
    FROM video_assets a
    LEFT JOIN video_asset_tags t
      ON t.asset_id = a.id AND t.segment_id IS NULL
    LEFT JOIN video_asset_descriptions d
      ON d.asset_id = a.id
    WHERE a.org_id = p_org_id
      AND a.is_deleted_on_drive = false
      AND a.duplicate_of IS NULL
      AND a.archived_at IS NULL
      AND (
        a.file_name ILIKE '%' || p_q || '%'
        OR a.drive_path ILIKE '%' || p_q || '%'
        OR t.tag ILIKE '%' || p_q || '%'
        OR d.summary ILIKE '%' || p_q || '%'
      )
      AND (p_sort <> 'favorites' OR a.is_favorite = true)
  )
  SELECT m.id, count(*) OVER () AS total_count
  FROM matched m
  ORDER BY
    CASE WHEN p_sort = 'oldest' THEN m.created_at END ASC,
    CASE WHEN p_sort = 'az' THEN m.file_name END ASC,
    CASE WHEN p_sort = 'za' THEN m.file_name END DESC,
    CASE WHEN p_sort = 'favorites' THEN m.favorited_at END DESC,
    CASE WHEN p_sort NOT IN ('oldest','az','za','favorites') THEN m.created_at END DESC,
    m.id
  LIMIT p_limit OFFSET p_offset;
$$;
