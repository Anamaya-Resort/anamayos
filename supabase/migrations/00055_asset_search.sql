-- ══════════════════════════════════════════════════════════════
-- 00055 - Search that includes the folder path, done server-side
--
-- Two faults with the old approach.
--
-- It ignored drive_path. "drone" returned nothing useful even though
-- 51 photos sit in /Duerte Photos/Drone/ - the folder somebody filed a
-- picture under is a deliberate statement about what it is, and often
-- the only one, since a drone shot contains no drone.
--
-- And it matched tags in a second query, then pasted the resulting ids
-- into the URL as id.in.(...). A broad word like "drone" hits 677
-- assets; 500 uuids is about 18KB of URL, past what the request will
-- carry, so the search quietly returned nothing at all.
--
-- Doing the match in the database fixes both: the ids never travel,
-- and the folder path is just another column to look at.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_asset_ids(
  p_org_id uuid,
  p_q text,
  p_limit int DEFAULT 5000
)
RETURNS TABLE (asset_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT a.id
  FROM video_assets a
  LEFT JOIN video_asset_tags t
    ON t.asset_id = a.id AND t.segment_id IS NULL
  LEFT JOIN video_asset_descriptions d
    ON d.asset_id = a.id
  WHERE a.org_id = p_org_id
    AND a.is_deleted_on_drive = false
    AND (
      a.file_name ILIKE '%' || p_q || '%'
      -- The folder path carries as much intent as the filename.
      OR a.drive_path ILIKE '%' || p_q || '%'
      OR t.tag ILIKE '%' || p_q || '%'
      OR d.summary ILIKE '%' || p_q || '%'
    )
  LIMIT p_limit;
$$;

-- ILIKE '%x%' cannot use a b-tree, so give the two hot columns trigram
-- indexes. Without them every search is two full scans of 6,700 rows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_va_filename_trgm
  ON video_assets USING gin (file_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_va_drivepath_trgm
  ON video_assets USING gin (drive_path gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vat_tag_trgm
  ON video_asset_tags USING gin (tag gin_trgm_ops);
