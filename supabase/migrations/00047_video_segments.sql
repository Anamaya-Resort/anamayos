-- ══════════════════════════════════════════════════════════════
-- 00047 — Video segments (Slice 5: video pipeline)
--
-- A video asset decomposes into SEGMENTS: scene/shot-boundary
-- sampled stills, each with a timecode range [start_ms,end_ms),
-- so a long source video becomes a set of individually-pickable,
-- individually-tagged clips. video_assets stays the file-level
-- row (one video proxy + poster); segments hang off it.
--
-- Frame-level tags reuse video_asset_tags via a nullable
-- segment_id (NULL = whole-asset tag, set = that segment's tag).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_asset_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  idx int NOT NULL,                       -- 0-based order within the asset
  start_ms int NOT NULL,
  end_ms int NOT NULL,
  frame_path text,                        -- sampled keyframe still (video-proxies bucket)
  color_temp text,                        -- warm | neutral | cool
  brightness real,                        -- 0..1
  dominant_colors jsonb,                  -- [{hex,pct}]
  aesthetic_score real,                   -- 1..10
  detections jsonb,                       -- [{label,kind,role,bbox,confidence}]
  archetype_fit jsonb,                    -- [{archetype_id,score}]
  summary text,
  analysis_model text,
  analysis_cost_cents int,
  created_at timestamptz DEFAULT now(),
  UNIQUE (asset_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_vaseg_asset
  ON video_asset_segments (asset_id, start_ms);
CREATE INDEX IF NOT EXISTS idx_vaseg_org
  ON video_asset_segments (org_id);

ALTER TABLE video_asset_tags
  ADD COLUMN IF NOT EXISTS segment_id uuid
    REFERENCES video_asset_segments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_vat_segment
  ON video_asset_tags (segment_id) WHERE segment_id IS NOT NULL;

-- RLS — same deny-by-default + service-role pattern as 00041.
ALTER TABLE video_asset_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON video_asset_segments;
CREATE POLICY "Service role full access" ON video_asset_segments
  FOR ALL USING (true) WITH CHECK (true);
