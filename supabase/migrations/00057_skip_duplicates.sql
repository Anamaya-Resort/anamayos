-- ══════════════════════════════════════════════════════════════
-- 00057 - Flag duplicates at crawl time and skip processing them
--
-- Adding folders that overlap what we already hold is now the normal
-- case, not the exception: whole folders, subfolders and stray files
-- get re-shared between accounts and services. Ingesting those copies
-- costs a Drive download, a resize and a paid vision call each, and
-- fills the collection with the same photograph several times.
--
-- Detection is by content hash, so it holds across folders, across
-- sources, and across providers - a file copied from Drive into
-- Dropbox has the same bytes and the same hash.
--
-- 'skipped' is a third state beside done and error: nothing went
-- wrong, there was simply no work to do.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION flag_duplicate_assets(p_org_id uuid)
RETURNS TABLE (flagged int)
LANGUAGE plpgsql
AS $$
DECLARE
  n int;
BEGIN
  WITH canonical AS (
    -- The earliest asset for each hash is the one we keep. Anything
    -- already processed wins over anything still queued, so a new
    -- copy never displaces the copy that has the thumbnails.
    SELECT DISTINCT ON (drive_md5_checksum)
           id, drive_md5_checksum
    FROM video_assets
    WHERE org_id = p_org_id
      AND drive_md5_checksum IS NOT NULL
      AND is_deleted_on_drive = false
    ORDER BY drive_md5_checksum,
             (proxy_status = 'done') DESC,
             created_at ASC
  )
  UPDATE video_assets a
  SET duplicate_of = c.id,
      duplicate_status = 'exact',
      -- Nothing to do: no download, no resize, no vision call.
      proxy_status = 'skipped',
      analysis_status = 'skipped'
  FROM canonical c
  WHERE a.org_id = p_org_id
    AND a.drive_md5_checksum = c.drive_md5_checksum
    AND a.id <> c.id
    AND a.is_deleted_on_drive = false
    AND a.proxy_status IN ('pending', 'error')
    AND a.analysis_status IN ('pending', 'error');

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN QUERY SELECT n;
END;
$$;

-- Backfill: anything already queued that duplicates something we hold.
SELECT flag_duplicate_assets(id) FROM organizations;
