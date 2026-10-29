-- Site registry for the marketing dashboard.
--
-- GA4 and Search Console are not ad platforms, so they do not belong in
-- `marketing_platforms` as dashboard tabs. They are credential holders, so
-- `marketing_platforms` gains a `kind` column and the dashboard tabs filter
-- on kind='ads'.
--
-- One GA4 property already reports every subdomain that carries the same
-- gtag (verified: go./staging./test./awaken.anamaya.com all appear under the
-- hostName dimension of property 371232847), and a Search Console DOMAIN
-- property already covers every subdomain. So a new subdomain usually needs
-- no new property at all — just a filter. Hence ga4_hostname and gsc_page_filter.

ALTER TABLE marketing_platforms
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'ads';

INSERT INTO marketing_platforms (key, name, sort_order, logo_slug, placements, is_active, kind)
VALUES ('google_analytics', 'Google Analytics & Search Console', 90, 'google', '{}', true, 'analytics')
ON CONFLICT (key) DO UPDATE SET kind = 'analytics', name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS marketing_sites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The hostname as visitors type it, e.g. 'www.anamaya.com'.
  domain        text NOT NULL UNIQUE,
  label         text NOT NULL,
  -- GA4 numeric property id. Subdomains sharing one gtag share this id.
  ga4_property_id text,
  -- Value to match against GA4's hostName dimension. Null means no filter,
  -- i.e. the whole property.
  ga4_hostname  text,
  -- Search Console property, e.g. 'sc-domain:anamaya.com'. A domain property
  -- covers every subdomain.
  gsc_property  text,
  -- Optional 'page contains' filter, to slice one subdomain out of a domain
  -- property.
  gsc_page_filter text,
  is_primary    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 100,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_sites_active
  ON marketing_sites(is_active, sort_order);

-- Only one primary site.
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_sites_one_primary
  ON marketing_sites(is_primary) WHERE is_primary;

ALTER TABLE marketing_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_sites_service ON marketing_sites;
CREATE POLICY marketing_sites_service ON marketing_sites
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cached daily rollups, so the dashboard does not hit Google on every render
-- and so history survives beyond Google's own retention.
CREATE TABLE IF NOT EXISTS site_metrics_daily (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES marketing_sites(id) ON DELETE CASCADE,
  stat_date     date NOT NULL,
  sessions      bigint NOT NULL DEFAULT 0,
  users         bigint NOT NULL DEFAULT 0,
  conversions   bigint NOT NULL DEFAULT 0,
  gsc_clicks    bigint NOT NULL DEFAULT 0,
  gsc_impressions bigint NOT NULL DEFAULT 0,
  gsc_position  numeric(6,2),
  synced_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, stat_date)
);
CREATE INDEX IF NOT EXISTS idx_site_metrics_date ON site_metrics_daily(stat_date);

ALTER TABLE site_metrics_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_metrics_daily_service ON site_metrics_daily;
CREATE POLICY site_metrics_daily_service ON site_metrics_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed the site we already have verified access to.
INSERT INTO marketing_sites
  (domain, label, ga4_property_id, ga4_hostname, gsc_property, is_primary, sort_order)
VALUES
  ('www.anamaya.com', 'Anamaya (main site)', '371232847', NULL, 'sc-domain:anamaya.com', true, 10)
ON CONFLICT (domain) DO NOTHING;
