-- ============================================================
-- 00041: Video Maker — full feature schema
-- ============================================================
-- One migration that creates every table the Video Maker module
-- needs across all slices. Tables exist before their slice ships;
-- RLS is on by default and service-role-only (the app uses the
-- service client with explicit org_id filtering).
--
-- Sections:
--   1. Extensions + enums
--   2. Google Drive connections + sources
--   3. Assets (Drive metadata, proxies, dedupe)
--   4. Asset intelligence (descriptions, tags, transcripts, embeddings)
--   5. Asset permissions (privacy first-class)
--   6. Asset reviews (human corrections)
--   7. Music library with license rights
--   8. Platform specs (data-driven, not hardcoded)
--   9. Campaigns + scripts
--   10. Versioned timelines (JSON Patch chain)
--   11. Render jobs (idempotent, permission-gated)
--   12. Asset usage tracking (matcher freshness)
--   13. AI model roles + per-org quotas
--   14. Cost ledger + job logs
--   15. Storage buckets
--   16. Helper functions (per-org defaults seeding)
--   17. RLS policies
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. EXTENSIONS + ENUMS
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE video_use_permission AS ENUM (
    'unknown',
    'do_not_use',
    'internal_only',
    'organic_social_ok',
    'ads_ok',
    'public_marketing_ok'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE video_render_intent AS ENUM (
    'internal',
    'organic_social',
    'ads',
    'public_marketing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════
-- 2. GOOGLE DRIVE CONNECTIONS + SOURCES
-- Account-level OAuth lives in google_drive_connections.
-- Each connection can have many folders/Shared Drives attached
-- via video_drive_sources. OAuth tokens are stored as Vault
-- secret ids — never as plaintext, never as bytea here.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS google_drive_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_account_email text NOT NULL,
  oauth_access_secret_id uuid NOT NULL,   -- vault.secrets.id
  oauth_refresh_secret_id uuid NOT NULL,  -- vault.secrets.id
  oauth_scope text NOT NULL,
  start_page_token text,                  -- Drive Changes API cursor
  status text NOT NULL DEFAULT 'active',  -- active|revoked|error|expired
  last_token_refresh_at timestamptz,
  last_error text,
  added_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, google_account_email)
);
CREATE INDEX IF NOT EXISTS idx_gdc_org ON google_drive_connections(org_id);

CREATE TABLE IF NOT EXISTS video_drive_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES google_drive_connections(id) ON DELETE CASCADE,
  property_id uuid REFERENCES org_properties(id) ON DELETE SET NULL,
  label text NOT NULL,
  drive_kind text NOT NULL,               -- 'my_drive_folder' | 'shared_drive_folder' | 'shared_drive_root'
  drive_folder_id text NOT NULL,
  drive_id text,                          -- shared drive id when applicable
  watch_mode text NOT NULL DEFAULT 'on_demand', -- 'on_demand' | 'daily' | 'realtime_webhook'
  is_active boolean DEFAULT true,
  last_scan_at timestamptz,
  scan_status text DEFAULT 'idle',        -- idle|scanning|error|paused
  scan_error text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, drive_folder_id)
);
CREATE INDEX IF NOT EXISTS idx_vds_connection ON video_drive_sources(connection_id);

-- ══════════════════════════════════════════════════════════════
-- 3. ASSETS
-- Each row = one Drive file. Drive remains canonical; we store
-- only the proxy path + thumb path here. Originals are pulled
-- on demand into video-source-cache for final-quality renders.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES video_drive_sources(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  drive_path text,
  drive_md5_checksum text,                -- exact-dedupe
  mime_type text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint,
  duration_ms int,                        -- null for images
  width int,
  height int,
  captured_at timestamptz,
  proxy_path text,                        -- video-proxies bucket
  thumb_path text,                        -- video-proxies bucket
  perceptual_hash text,                   -- pHash for near-dupe
  duplicate_of uuid REFERENCES video_assets(id) ON DELETE SET NULL,
  duplicate_status text,                  -- null | 'exact' | 'near' | 'reviewed_not_dupe'
  priority_score real DEFAULT 0,
  quality_score real,                     -- 0..1 from vision model
  analysis_status text DEFAULT 'pending', -- pending|analyzing|done|error
  analysis_error text,
  is_deleted_on_drive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (source_id, drive_file_id)
);
CREATE INDEX IF NOT EXISTS idx_va_org_priority
  ON video_assets (org_id, priority_score DESC)
  WHERE is_deleted_on_drive = false;
CREATE INDEX IF NOT EXISTS idx_va_md5
  ON video_assets (org_id, drive_md5_checksum)
  WHERE drive_md5_checksum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_va_phash
  ON video_assets (org_id, perceptual_hash)
  WHERE perceptual_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_va_status
  ON video_assets (org_id, analysis_status);

-- ══════════════════════════════════════════════════════════════
-- 4. ASSET INTELLIGENCE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_asset_descriptions (
  asset_id uuid PRIMARY KEY REFERENCES video_assets(id) ON DELETE CASCADE,
  summary text,
  model_endpoint text,
  cost_cents int,
  generated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_asset_tags (
  id bigserial PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  tag text NOT NULL,
  source text NOT NULL CHECK (source IN ('ai','human','brand_vocab')),
  confidence real,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vat_asset ON video_asset_tags (asset_id);
CREATE INDEX IF NOT EXISTS idx_vat_tag ON video_asset_tags (tag);

CREATE TABLE IF NOT EXISTS video_asset_transcripts (
  asset_id uuid PRIMARY KEY REFERENCES video_assets(id) ON DELETE CASCADE,
  lang text,
  full_text text,
  segments jsonb,
  model_endpoint text,
  cost_cents int,
  generated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_asset_embeddings (
  asset_id uuid PRIMARY KEY REFERENCES video_assets(id) ON DELETE CASCADE,
  embedding vector(1536),
  model_endpoint text,
  generated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vae_hnsw
  ON video_asset_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ══════════════════════════════════════════════════════════════
-- 5. ASSET PERMISSIONS (privacy first-class)
-- Render gate refuses to render if any clip's permission is
-- below the render's intent_destination.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_asset_permissions (
  asset_id uuid PRIMARY KEY REFERENCES video_assets(id) ON DELETE CASCADE,
  use_permission video_use_permission NOT NULL DEFAULT 'unknown',
  has_recognizable_faces boolean,
  has_minor_faces boolean,
  is_staff_only boolean,
  release_documented boolean DEFAULT false,
  release_document_url text,
  permission_notes text,
  set_by uuid,
  set_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 6. ASSET REVIEWS (human corrections preferred over AI)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_asset_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  approval_status text NOT NULL CHECK (approval_status IN ('approved','rejected','pending')),
  marketing_use_cases text[] DEFAULT '{}',
  corrected_summary text,
  corrected_tags text[] DEFAULT '{}',
  staff_notes text,
  edited_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_var_asset_time ON video_asset_reviews (asset_id, edited_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 7. MUSIC LIBRARY WITH RIGHTS
-- Render gate checks rights against destination.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text,
  source text NOT NULL,                   -- uploaded|epidemic_sound|artlist|cc0|public_domain
  license_type text NOT NULL,
  rights jsonb NOT NULL,                  -- { ads_ok, organic_ok, public_marketing_ok, attribution_required, attribution_text }
  storage_path text NOT NULL,             -- video-music bucket
  duration_ms int,
  bpm int,
  mood_tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  added_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vmt_org ON video_music_tracks (org_id);

-- ══════════════════════════════════════════════════════════════
-- 8. PLATFORM SPECS (data-driven)
-- Edit limits here when platforms change theirs; no redeploy needed.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_platform_specs (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  aspect text NOT NULL,
  max_duration_ms int NOT NULL,
  min_duration_ms int,
  recommended_fps int DEFAULT 30,
  max_file_size_bytes bigint,
  safe_zones jsonb,                       -- { top_pct, bottom_pct, left_pct, right_pct }
  audio_required boolean DEFAULT true,
  is_ad boolean DEFAULT false,
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO video_platform_specs (id, display_name, aspect, max_duration_ms, min_duration_ms, recommended_fps, max_file_size_bytes, safe_zones, audio_required, is_ad) VALUES
  ('instagram_reel',  'Instagram Reel',  '9:16', 90000,  3000, 30, 4294967296, '{"top_pct":14,"bottom_pct":20,"left_pct":4,"right_pct":4}'::jsonb, true,  false),
  ('instagram_post',  'Instagram Post',  '1:1',  60000,  3000, 30, 4294967296, '{"top_pct":6,"bottom_pct":6,"left_pct":4,"right_pct":4}'::jsonb,   true,  false),
  ('youtube_short',   'YouTube Short',   '9:16', 60000,  3000, 30, 4294967296, '{"top_pct":12,"bottom_pct":18,"left_pct":4,"right_pct":4}'::jsonb, true,  false),
  ('youtube_long',    'YouTube',         '16:9', 1800000, 5000, 30, 137438953472, '{"top_pct":4,"bottom_pct":12,"left_pct":2,"right_pct":2}'::jsonb, true, false),
  ('x_post',          'X / Twitter',     '16:9', 140000, 3000, 30, 536870912, '{"top_pct":4,"bottom_pct":4,"left_pct":4,"right_pct":4}'::jsonb,   true,  false),
  ('telegram',        'Telegram',        '9:16', 120000, 3000, 30, 2147483648, '{"top_pct":6,"bottom_pct":6,"left_pct":4,"right_pct":4}'::jsonb,   true,  false),
  ('facebook_reel',   'Facebook Reel',   '9:16', 90000,  3000, 30, 4294967296, '{"top_pct":14,"bottom_pct":20,"left_pct":4,"right_pct":4}'::jsonb, true,  false),
  ('facebook_post',   'Facebook Post',   '1:1',  240000, 3000, 30, 4294967296, '{"top_pct":6,"bottom_pct":6,"left_pct":4,"right_pct":4}'::jsonb,   true,  false),
  ('ad_9x16',         'Vertical Ad',     '9:16', 60000,  6000, 30, 4294967296, '{"top_pct":14,"bottom_pct":20,"left_pct":4,"right_pct":4}'::jsonb, true,  true),
  ('ad_1x1',          'Square Ad',       '1:1',  60000,  6000, 30, 4294967296, '{"top_pct":6,"bottom_pct":6,"left_pct":4,"right_pct":4}'::jsonb,   true,  true),
  ('website_hero',    'Website Hero',    '16:9', 30000,  4000, 30, 1073741824, '{"top_pct":4,"bottom_pct":4,"left_pct":2,"right_pct":2}'::jsonb,   false, false)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 9. CAMPAIGNS + SCRIPTS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES org_properties(id) ON DELETE SET NULL,
  name text NOT NULL,
  goal text,
  archetype_id uuid,
  brand_guide_id uuid REFERENCES ai_brand_guide(id),
  platform_variant_ids text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vc_org ON video_campaigns (org_id);

CREATE TABLE IF NOT EXISTS video_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES video_campaigns(id) ON DELETE CASCADE,
  version int NOT NULL,
  beats jsonb NOT NULL,                   -- [{node_id, intent, voiceover, b_roll_hints[], duration_target_s}]
  platform_variants jsonb NOT NULL,       -- { platform_id: { caption, hashtags, cta } }
  model_endpoint text,
  cost_cents int,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, version)
);

-- ══════════════════════════════════════════════════════════════
-- 10. VERSIONED TIMELINES (JSON Patch chain)
-- Conversational editing produces new versions by applying
-- RFC 6902 patches. Renders are deterministic per (timeline_id,
-- version, platform_variant_id).
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  script_id uuid NOT NULL REFERENCES video_scripts(id) ON DELETE CASCADE,
  version int NOT NULL,
  parent_version int,
  doc jsonb NOT NULL,                     -- the Timeline JSON (see src/modules/video/types.ts)
  patch_from_parent jsonb,                -- RFC 6902 ops; null on v1
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (script_id, version)
);
CREATE INDEX IF NOT EXISTS idx_vt_script_version ON video_timelines (script_id, version DESC);

-- ══════════════════════════════════════════════════════════════
-- 11. RENDER JOBS (idempotent, permission-gated)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  timeline_id uuid NOT NULL REFERENCES video_timelines(id) ON DELETE CASCADE,
  timeline_version int NOT NULL,
  platform_variant_id text NOT NULL REFERENCES video_platform_specs(id),
  intent_destination video_render_intent NOT NULL,
  status text NOT NULL DEFAULT 'queued',
    -- queued|running|done|failed|cancelled|blocked_permissions|blocked_music_rights
  output_path text,
  output_duration_ms int,
  cpu_seconds real,
  cost_cents int,
  error text,
  watermarked boolean DEFAULT true,
  started_at timestamptz,
  finished_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,   -- sha256(timeline_id|version|platform_variant_id)
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vrj_org_status ON video_render_jobs (org_id, status);

-- ══════════════════════════════════════════════════════════════
-- 12. ASSET USAGE TRACKING (matcher freshness)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_asset_usages (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  render_id uuid REFERENCES video_render_jobs(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES video_campaigns(id) ON DELETE SET NULL,
  platform_variant_id text,
  exported boolean DEFAULT false,
  exported_at timestamptz,
  performance jsonb,                      -- ingested later from platform APIs
  used_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vau_asset_time ON video_asset_usages (asset_id, used_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 13. AI MODEL ROLES + PER-ORG QUOTAS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_maker_model_roles (
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('vision','transcript','embed','script','edit','caption')),
  provider_id text NOT NULL REFERENCES ai_providers(id),
  model_endpoint text NOT NULL,
  cost_per_1k_input_cents int,
  cost_per_1k_output_cents int,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, role)
);

CREATE TABLE IF NOT EXISTS video_org_quotas (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter',
  storage_bytes_cap bigint NOT NULL DEFAULT 50000000000,    -- 50 GB
  renders_per_month_cap int NOT NULL DEFAULT 100,
  ai_cents_per_day_cap int NOT NULL DEFAULT 500,            -- $5/day
  concurrent_renders_cap int NOT NULL DEFAULT 2,
  drive_scan_concurrency_cap int NOT NULL DEFAULT 1,
  conversational_edits_per_hour_cap int NOT NULL DEFAULT 30,
  updated_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 14. COST LEDGER + STRUCTURED LOGS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_cost_ledger (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
    -- vision|transcript|embed|script|edit|caption|render|storage|enhancement
  cents int NOT NULL,
  ref_id uuid,
  occurred_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vcl_org_time ON video_cost_ledger (org_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS video_job_logs (
  id bigserial PRIMARY KEY,
  org_id uuid,
  job_id uuid,
  level text NOT NULL CHECK (level IN ('debug','info','warn','error')),
  message text NOT NULL,
  context jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vjl_org_time ON video_job_logs (org_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 15. STORAGE BUCKETS (six private buckets, signed-URL access)
-- TTLs for video-temp and video-source-cache are enforced by a
-- pg-boss cron job in the worker, not by Supabase Storage policies.
-- ══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) VALUES
  ('video-proxies',      'video-proxies',      false),
  ('video-renders',      'video-renders',      false),
  ('video-overlays',     'video-overlays',     false),
  ('video-music',        'video-music',        false),
  ('video-source-cache', 'video-source-cache', false),
  ('video-temp',         'video-temp',         false)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 16. HELPER FUNCTIONS
-- video_maker_seed_org_defaults(org_id): called once per org to
-- install the default model-role map + starter quota. Idempotent.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION video_maker_seed_org_defaults(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO video_org_quotas (org_id) VALUES (p_org_id)
  ON CONFLICT (org_id) DO NOTHING;

  INSERT INTO video_maker_model_roles (org_id, role, provider_id, model_endpoint) VALUES
    (p_org_id, 'vision',     'google',    'gemini-2.5-flash'),
    (p_org_id, 'transcript', 'openai',    'whisper-1'),
    (p_org_id, 'embed',      'openai',    'text-embedding-3-small'),
    (p_org_id, 'script',     'anthropic', 'claude-sonnet-4-6'),
    (p_org_id, 'edit',       'anthropic', 'claude-sonnet-4-6'),
    (p_org_id, 'caption',    'anthropic', 'claude-haiku-4-5-20251001')
  ON CONFLICT (org_id, role) DO NOTHING;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 17. RLS — deny-by-default, service role allowed.
-- The app uses createServiceClient() with explicit org_id
-- filtering in every query, same pattern as other modules.
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'google_drive_connections',
    'video_drive_sources',
    'video_assets',
    'video_asset_descriptions',
    'video_asset_tags',
    'video_asset_transcripts',
    'video_asset_embeddings',
    'video_asset_permissions',
    'video_asset_reviews',
    'video_music_tracks',
    'video_platform_specs',
    'video_campaigns',
    'video_scripts',
    'video_timelines',
    'video_render_jobs',
    'video_asset_usages',
    'video_maker_model_roles',
    'video_org_quotas',
    'video_cost_ledger',
    'video_job_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON %I', t);
    EXECUTE format('CREATE POLICY "Service role full access" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END
$$;

-- ============================================================
-- End of 00041_video_maker.sql
-- ============================================================
