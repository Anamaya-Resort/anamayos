-- ============================================================
-- 00045: Slice 3 — vision analysis schema
-- ============================================================
-- Stores the controlled tag vocabulary, plus the structured
-- analysis outputs per asset:
--   - deterministic visual stats (color temp, brightness, palette)
--   - aesthetic score
--   - localized detections (faces + objects w/ bounding boxes) for
--     the Scan Theater + face-aware Ken Burns
--   - flat searchable tags w/ category + optional bbox
--
-- Archetypes are NOT created here — they live in the existing
-- ai_customer_archetypes table (per-org). Vision tagging reads
-- archetype fit against that table.
-- ============================================================

-- Controlled tag vocabulary. org_id NULL = platform default set
-- (any org uses it); per-org rows override later (Slice 4 staff
-- tools). Vision model tags against the active vocabulary; it may
-- also propose freeform tags (source='ai', not in vocab) that go
-- to human review.
CREATE TABLE IF NOT EXISTS video_tag_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL,          -- subject | activity | mood | people | marketing_use
  tag text NOT NULL,
  localizable boolean NOT NULL DEFAULT false,  -- can be drawn as a box on the image
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, category, tag)
);
CREATE INDEX IF NOT EXISTS idx_vtv_lookup
  ON video_tag_vocabulary (org_id, category) WHERE is_active = true;

-- Platform-default vocabulary (org_id NULL). Locked with the user.
INSERT INTO video_tag_vocabulary (org_id, category, tag, localizable, sort_order) VALUES
  -- subject (most are localizable — a box can be drawn)
  (NULL,'subject','yoga',true,1),(NULL,'subject','meditation',true,2),
  (NULL,'subject','surfing',true,3),(NULL,'subject','beach',false,4),
  (NULL,'subject','ocean',false,5),(NULL,'subject','jungle',false,6),
  (NULL,'subject','waterfall',true,7),(NULL,'subject','pool',true,8),
  (NULL,'subject','spa',true,9),(NULL,'subject','massage',true,10),
  (NULL,'subject','dining',true,11),(NULL,'subject','food',true,12),
  (NULL,'subject','chef skills',true,13),(NULL,'subject','wildlife',true,14),
  (NULL,'subject','birdwatching',true,15),(NULL,'subject','hiking',true,16),
  (NULL,'subject','drone landscape',false,17),(NULL,'subject','sunset',false,18),
  (NULL,'subject','accommodation',false,19),(NULL,'subject','excursion',true,20),
  (NULL,'subject','staff',true,21),(NULL,'subject','guests',true,22),
  -- activity (global — describes the scene)
  (NULL,'activity','practicing yoga',false,1),(NULL,'activity','meditating',false,2),
  (NULL,'activity','surfing',false,3),(NULL,'activity','hiking',false,4),
  (NULL,'activity','spa treatment',false,5),(NULL,'activity','dining',false,6),
  (NULL,'activity','ceremony or workshop',false,7),(NULL,'activity','relaxing',false,8),
  (NULL,'activity','traveling',false,9),
  -- mood (global)
  (NULL,'mood','serene',false,1),(NULL,'mood','joyful',false,2),
  (NULL,'mood','energizing',false,3),(NULL,'mood','intimate',false,4),
  (NULL,'mood','luxurious',false,5),(NULL,'mood','adventurous',false,6),
  (NULL,'mood','transformational',false,7),(NULL,'mood','playful',false,8),
  -- people (localizable — faces)
  (NULL,'people','solo',true,1),(NULL,'people','couple',true,2),
  (NULL,'people','small group',true,3),(NULL,'people','large group',true,4),
  (NULL,'people','instructor',true,5),(NULL,'people','candid',false,6),
  (NULL,'people','posed',false,7),(NULL,'people','no faces',false,8),
  -- marketing_use (global)
  (NULL,'marketing_use','hero',false,1),(NULL,'marketing_use','b-roll',false,2),
  (NULL,'marketing_use','testimonial',false,3),(NULL,'marketing_use','social-first',false,4),
  (NULL,'marketing_use','ad-safe',false,5),(NULL,'marketing_use','before/after',false,6)
ON CONFLICT (org_id, category, tag) DO NOTHING;

-- Per-asset analysis outputs (deterministic + model).
ALTER TABLE video_assets
  ADD COLUMN IF NOT EXISTS color_temp text,            -- warm | neutral | cool
  ADD COLUMN IF NOT EXISTS brightness real,            -- 0..1 mean luma
  ADD COLUMN IF NOT EXISTS dominant_colors jsonb,      -- [{hex,pct}]
  ADD COLUMN IF NOT EXISTS aesthetic_score real,       -- 1..10
  ADD COLUMN IF NOT EXISTS detections jsonb,           -- [{label,kind,bbox:[x,y,w,h] normalized,confidence}]
  ADD COLUMN IF NOT EXISTS archetype_fit jsonb,        -- [{archetype_id,score}]
  ADD COLUMN IF NOT EXISTS analysis_model text,
  ADD COLUMN IF NOT EXISTS analysis_cost_cents int;

-- video_asset_tags already exists (tag, source, confidence).
-- Add category + optional bounding box for localized tags.
ALTER TABLE video_asset_tags
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS bbox jsonb;                 -- [x,y,w,h] normalized 0..1, null = global
