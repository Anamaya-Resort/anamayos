-- ══════════════════════════════════════════════════════════════
-- 00053 - Galleries: named, ordered sets of library images
--
-- The reason the library exists. A gallery is a curated selection
-- that a page or template can render by code, so editors pick photos
-- once here and every surface that references the code follows.
--
-- Membership, not ownership: an image belongs to the library and can
-- sit in any number of galleries. Removing it from a gallery never
-- touches the image.
--
-- Modelled on the rooms precedent - the website block holds display
-- settings only and reads the contents live from this database, so a
-- gallery edited here updates everywhere it appears.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Stable handle used by page and template blocks: gallery_1, ...
  -- Never reused, so a deleted gallery cannot be resurrected by a
  -- stale reference pointing at somebody else's photos.
  code text NOT NULL,
  name text NOT NULL,
  description text,
  cover_asset_id uuid REFERENCES video_assets(id) ON DELETE SET NULL,
  -- Only published galleries are readable by the public site.
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, code)
);
CREATE INDEX IF NOT EXISTS idx_vg_org ON video_galleries (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS video_gallery_items (
  gallery_id uuid NOT NULL REFERENCES video_galleries(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  caption text,
  added_by uuid,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (gallery_id, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_vgi_gallery
  ON video_gallery_items (gallery_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vgi_asset ON video_gallery_items (asset_id);

-- Sequential per-org codes. A counter table rather than max(code)+1,
-- which would race two editors into the same code and would start
-- handing out numbers again after a delete.
CREATE TABLE IF NOT EXISTS video_gallery_code_seq (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  next_n int NOT NULL DEFAULT 1
);

CREATE OR REPLACE FUNCTION next_gallery_code(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  n int;
BEGIN
  INSERT INTO video_gallery_code_seq (org_id, next_n) VALUES (p_org_id, 1)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE video_gallery_code_seq
  SET next_n = next_n + 1
  WHERE org_id = p_org_id
  RETURNING next_n - 1 INTO n;

  RETURN 'gallery_' || n;
END;
$$;

ALTER TABLE video_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_gallery_code_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON video_galleries;
CREATE POLICY "Service role full access" ON video_galleries
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access" ON video_gallery_items;
CREATE POLICY "Service role full access" ON video_gallery_items
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access" ON video_gallery_code_seq;
CREATE POLICY "Service role full access" ON video_gallery_code_seq
  FOR ALL USING (true) WITH CHECK (true);

-- The website reads with the anon key, so published galleries only.
-- Same pattern the retreat and brand tables already use.
DROP POLICY IF EXISTS "Anon read published galleries" ON video_galleries;
CREATE POLICY "Anon read published galleries" ON video_galleries
  FOR SELECT TO anon USING (is_published = true);
DROP POLICY IF EXISTS "Anon read published gallery items" ON video_gallery_items;
CREATE POLICY "Anon read published gallery items" ON video_gallery_items
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM video_galleries g
      WHERE g.id = gallery_id AND g.is_published = true
    )
  );
