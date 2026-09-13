-- ══════════════════════════════════════════════════════════════
-- 00059 - Let the public site read the photographs in a published
-- gallery.
--
-- 00053 opened video_galleries and video_gallery_items to anon, but
-- not video_assets - where the file path, dimensions and name live.
-- So the website could read that gallery_4 contains twelve images and
-- learn nothing about any of them, and every published gallery
-- rendered as empty.
--
-- Membership is the grant, deliberately: an asset becomes readable by
-- being put into a published gallery and stops being readable when it
-- is taken out or the gallery is unpublished. The rest of the library
-- - what was scanned, what it was named, what the model tagged it -
-- stays private. The storage bucket is public, so this exposes no new
-- pixels; it exposes the inventory, and only the curated part of it.
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anon read published gallery assets" ON video_assets;
CREATE POLICY "Anon read published gallery assets" ON video_assets
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1
      FROM video_gallery_items i
      JOIN video_galleries g ON g.id = i.gallery_id
      WHERE i.asset_id = video_assets.id
        AND g.is_published = true
    )
  );

-- The policy's subquery runs per candidate row, so the reverse lookup
-- (asset -> its galleries) needs to be an index hit. idx_vgi_asset
-- from 00053 covers it; named here so the dependency is on the record.
