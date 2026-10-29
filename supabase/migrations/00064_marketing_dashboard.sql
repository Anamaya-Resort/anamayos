-- ============================================================
-- 00064: Marketing / Paid Ads dashboard (/dash)
--
-- Design notes:
--  * Secrets live in marketing_secrets, which NO non-service role can
--    read. The UI reads marketing_secret_status instead, which exposes
--    only the last 4 characters so an admin can confirm what is saved.
--  * Non-secret public identifiers (pixel ids, ad account ids, GA4
--    measurement ids) live in marketing_settings and ARE readable by
--    staff, because they already appear in public page source.
--  * ad_spend_daily is the single fact table every spend metric reads.
--    It stays empty until a platform connector runs, and the UI shows
--    "awaiting connection" rather than a misleading zero.
-- ============================================================

-- ── 1. Platforms (the tabs) ──
CREATE TABLE IF NOT EXISTS marketing_platforms (
  key           text PRIMARY KEY,
  name          text NOT NULL,
  sort_order    int  NOT NULL DEFAULT 0,
  logo_slug     text,
  placements    text[] NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO marketing_platforms (key, name, sort_order, logo_slug, placements) VALUES
  ('instagram','Instagram',10,'instagram', ARRAY['all','stories','reels','feed','explore']),
  ('facebook', 'Facebook', 20,'facebook',  ARRAY['all','feed','stories','reels','marketplace','video']),
  ('tiktok',   'TikTok',   30,'tiktok',    ARRAY['all','in_feed','search','profile']),
  ('google',   'Google Ads',40,'google',   ARRAY['all','search','display','youtube','demand_gen','performance_max','remarketing'])
ON CONFLICT (key) DO UPDATE
  SET name=excluded.name, sort_order=excluded.sort_order,
      logo_slug=excluded.logo_slug, placements=excluded.placements;

-- ── 2. Non-secret settings (pixel ids etc.) ──
CREATE TABLE IF NOT EXISTS marketing_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key  text NOT NULL REFERENCES marketing_platforms(key) ON DELETE CASCADE,
  setting_key   text NOT NULL,
  setting_value text,
  label         text,
  notes         text,
  updated_by    uuid REFERENCES persons(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_key, setting_key)
);

-- ── 3. Secrets (write-only from the UI's point of view) ──
CREATE TABLE IF NOT EXISTS marketing_secrets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key  text NOT NULL REFERENCES marketing_platforms(key) ON DELETE CASCADE,
  secret_key    text NOT NULL,
  secret_value  text NOT NULL,
  last4         text,
  label         text,
  updated_by    uuid REFERENCES persons(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_key, secret_key)
);

CREATE OR REPLACE VIEW marketing_secret_status AS
  SELECT platform_key, secret_key, label, last4, updated_at
  FROM marketing_secrets;

-- ── 4. Ad entity hierarchy (campaign / ad set / ad) ──
CREATE TABLE IF NOT EXISTS ad_entities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key  text NOT NULL REFERENCES marketing_platforms(key) ON DELETE CASCADE,
  level         text NOT NULL CHECK (level IN ('campaign','adset','ad')),
  external_id   text NOT NULL,
  name          text,
  parent_external_id text,
  objective     text,
  status        text,
  retreat_id    uuid REFERENCES retreats(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_key, level, external_id)
);
CREATE INDEX IF NOT EXISTS idx_ad_entities_platform ON ad_entities(platform_key, level);

-- ── 5. Daily spend + performance facts ──
CREATE TABLE IF NOT EXISTS ad_spend_daily (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key  text NOT NULL REFERENCES marketing_platforms(key) ON DELETE CASCADE,
  stat_date     date NOT NULL,
  placement     text NOT NULL DEFAULT 'all',
  campaign_external_id text,
  adset_external_id    text,
  ad_external_id       text,
  retreat_id    uuid REFERENCES retreats(id) ON DELETE SET NULL,
  currency      text NOT NULL DEFAULT 'USD',
  spend         numeric(12,2) NOT NULL DEFAULT 0,
  impressions   bigint NOT NULL DEFAULT 0,
  clicks        bigint NOT NULL DEFAULT 0,
  video_views   bigint NOT NULL DEFAULT 0,
  platform_leads       int NOT NULL DEFAULT 0,
  platform_conversions int NOT NULL DEFAULT 0,
  platform_revenue     numeric(12,2) NOT NULL DEFAULT 0,
  synced_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_key, stat_date, placement, campaign_external_id, adset_external_id, ad_external_id)
);
CREATE INDEX IF NOT EXISTS idx_ad_spend_date ON ad_spend_daily(stat_date);
CREATE INDEX IF NOT EXISTS idx_ad_spend_platform_date ON ad_spend_daily(platform_key, stat_date);

-- ── 6. Per-source sync log, so every tile can state its freshness ──
CREATE TABLE IF NOT EXISTS marketing_sync_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key  text NOT NULL,
  status        text NOT NULL DEFAULT 'ok',
  rows_written  int  NOT NULL DEFAULT 0,
  message       text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_marketing_sync_platform ON marketing_sync_log(platform_key, started_at DESC);

-- ── 7. Campaign goals (0N1X-2 reads these as advisor context) ──
CREATE TABLE IF NOT EXISTS marketing_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  platform_key  text REFERENCES marketing_platforms(key) ON DELETE SET NULL,
  retreat_id    uuid REFERENCES retreats(id) ON DELETE SET NULL,
  period_start  date,
  period_end    date,
  target_spend  numeric(12,2),
  target_leads  int,
  target_bookings int,
  target_revenue  numeric(12,2),
  target_roas   numeric(8,2),
  body          text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 8. 0N1X-2 knowledge base + chat ──
CREATE TABLE IF NOT EXISTS onix_knowledge (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic         text NOT NULL,
  platform_key  text REFERENCES marketing_platforms(key) ON DELETE SET NULL,
  title         text NOT NULL,
  body          text NOT NULL,
  tags          text[] NOT NULL DEFAULT '{}',
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onix_knowledge_topic ON onix_knowledge(topic);

CREATE TABLE IF NOT EXISTS onix_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid REFERENCES persons(id) ON DELETE SET NULL,
  thread_id     uuid NOT NULL DEFAULT gen_random_uuid(),
  role          text NOT NULL CHECK (role IN ('user','assistant')),
  content       text NOT NULL,
  context_note  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onix_messages_thread ON onix_messages(thread_id, created_at);

-- ── RLS ──
ALTER TABLE marketing_platforms  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_secrets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_entities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_spend_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_sync_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_goals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE onix_knowledge       ENABLE ROW LEVEL SECURITY;
ALTER TABLE onix_messages        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['marketing_platforms','marketing_settings','ad_entities','ad_spend_daily','marketing_sync_log','marketing_goals','onix_knowledge','onix_messages']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_service', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)', t||'_service', t);
  END LOOP;
END $$;

-- Secrets: service role only. No policy for anyone else, so RLS denies all.
DROP POLICY IF EXISTS marketing_secrets_service ON marketing_secrets;
CREATE POLICY marketing_secrets_service ON marketing_secrets FOR ALL
  TO service_role USING (true) WITH CHECK (true);
