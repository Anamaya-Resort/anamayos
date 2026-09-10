-- ══════════════════════════════════════════════════════════════
-- 00056 - Search returns ONE PAGE of ids, already ordered
--
-- Returning every match just moved the problem: "drone" matches 698
-- assets, and 698 uuids in an id.in.(...) URL is ~26KB, the same
-- oversized request that broke search in the first place.
--
-- Ordering and paging belong here anyway - the database is the only
-- place that can sort the whole match set before slicing it.
-- ══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS search_asset_ids(uuid, text, int);

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
      AND (
        a.file_name ILIKE '%' || p_q || '%'
        -- The folder a picture is filed under says as much about it as
        -- its name, and often more: a drone shot contains no drone.
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
    CASE WHEN p_sort NOT IN ('oldest','az','za','favorites') THEN m.created_at END DESC
  LIMIT p_limit OFFSET p_offset;
$$;
