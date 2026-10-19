-- ══════════════════════════════════════════════════════════════
-- 00061 - Search: hide duplicates, and make paging stable
--
-- Two defects in search_assets_page, both of which the user saw.
--
-- 1. Duplicates were never excluded. 00057 deliberately leaves a
--    duplicate row unprocessed, so it has no thumbnail; the grid was
--    taught to skip them but the search was not, and it runs its own
--    query. Searching "pool" returned 66 duplicates, 54 of them with
--    no thumbnail - the same broken tiles that were supposedly fixed,
--    one keystroke away.
--
-- 2. No tiebreaker on any sort key, under OFFSET paging. 500 assets
--    share one created_at (a crawl batch inserted in the same
--    instant) and 490 file names are used more than once, so the
--    order within a tie group is whatever the planner feels like and
--    can differ between two requests. With infinite scroll fetching
--    page after page by offset, that silently repeats some images and
--    skips others - which is the likeliest cause of "after scrolling
--    down quite a bit, many of the thumbnails are missing".
--
--    id is appended to every ordering as the final key. It is unique,
--    so the sort is now total and a given offset always means the
--    same row.
-- ══════════════════════════════════════════════════════════════

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
      -- A duplicate is a second row for a photograph already in the
      -- results, and it has no thumbnail of its own.
      AND a.duplicate_of IS NULL
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
    CASE WHEN p_sort NOT IN ('oldest','az','za','favorites') THEN m.created_at END DESC,
    -- Unique final key: without it a tie group spanning several pages
    -- reorders between requests, and offset paging duplicates and
    -- drops rows.
    m.id
  LIMIT p_limit OFFSET p_offset;
$$;
