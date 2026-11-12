-- ============================================================
-- Social content analytics
-- ============================================================
-- Platform-agnostic on purpose. Nothing here says "Instagram":
-- `platform` is a column, metric names are the generic ones every
-- network reports (views / reach / saves / shares), and a new network
-- is a new row, never a new table. TikTok, YouTube, LinkedIn and
-- Pinterest all fit this shape as-is.
--
-- Two rules worth knowing before changing anything:
--
-- 1. METRICS ARE SNAPSHOTTED DAILY, never stored as one lifetime
--    total. Every platform API hands back a post's totals as of now.
--    Without a daily row you can never tell a post that took 10,000
--    views in two days from one that took four months, and you can
--    never scope a campaign window. The history cannot be
--    reconstructed later, so we take it from day one.
--
-- 2. COLOURS ARE THEME SLOTS, NOT HEX. A pillar stores color_slot 1..8
--    which resolves to var(--chart-N) at render. That keeps light/dark
--    working, and lets a white-label tenant restyle every chart from
--    one CSS block without touching data.
-- ============================================================

-- Accounts ---------------------------------------------------
CREATE TABLE IF NOT EXISTS social_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    text NOT NULL,
  external_id text,
  handle      text,
  label       text,
  -- The account's own posting timezone, not a global setting. A
  -- white-label client in another country gets their own, and the
  -- "when to post" grid is only meaningful in local time: Costa Rica is
  -- six hours behind UTC, so a 7am local post lands at 13:00 UTC and a
  -- UTC grid would tell you to post in the afternoon.
  timezone    text NOT NULL DEFAULT 'UTC',
  is_active   boolean NOT NULL DEFAULT true,
  -- Sample data is flagged, never mixed in silently. Every query and
  -- the page banner read this so nobody mistakes seeded numbers for
  -- real ones.
  is_sample   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

-- Content pillars (the category system) ----------------------
CREATE TABLE IF NOT EXISTS content_pillars (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  color_slot smallint NOT NULL DEFAULT 1 CHECK (color_slot BETWEEN 1 AND 8),
  sort_order smallint NOT NULL DEFAULT 100,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Posts ------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  external_id   text NOT NULL,
  permalink     text,
  -- reel | carousel | image | story | video | text
  format        text NOT NULL DEFAULT 'image',
  published_at  timestamptz NOT NULL,
  caption       text,
  thumbnail_url text,
  hashtags      text[] NOT NULL DEFAULT '{}',
  is_sample     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);
CREATE INDEX IF NOT EXISTS social_posts_published_idx ON social_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_account_idx   ON social_posts (account_id, published_at DESC);

-- Post -> pillar (many to many, exactly one primary) ---------
-- A teacher training post is also a yoga post. Multi-tagging keeps
-- that honest; is_primary stops the comparison charts double counting.
CREATE TABLE IF NOT EXISTS post_pillars (
  post_id    uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  pillar_id  uuid NOT NULL REFERENCES content_pillars(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  confidence numeric(4,3),
  -- 'auto' from the classifier, 'manual' from a human. Manual always
  -- wins and is never overwritten by a later auto pass.
  source     text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, pillar_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS post_pillars_one_primary_idx
  ON post_pillars (post_id) WHERE is_primary;

-- Daily snapshot, per post -----------------------------------
CREATE TABLE IF NOT EXISTS social_post_metrics_daily (
  post_id                 uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  metric_date             date NOT NULL,
  views                   integer NOT NULL DEFAULT 0,
  reach                   integer NOT NULL DEFAULT 0,
  non_follower_reach      integer NOT NULL DEFAULT 0,
  likes                   integer NOT NULL DEFAULT 0,
  comments                integer NOT NULL DEFAULT 0,
  saves                   integer NOT NULL DEFAULT 0,
  shares                  integer NOT NULL DEFAULT 0,
  follows                 integer NOT NULL DEFAULT 0,
  profile_visits          integer NOT NULL DEFAULT 0,
  link_clicks             integer NOT NULL DEFAULT 0,
  video_avg_watch_seconds numeric(6,2),
  PRIMARY KEY (post_id, metric_date)
);
CREATE INDEX IF NOT EXISTS social_post_metrics_date_idx
  ON social_post_metrics_daily (metric_date DESC);

-- Daily snapshot, per account --------------------------------
CREATE TABLE IF NOT EXISTS social_account_metrics_daily (
  account_id         uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  metric_date        date NOT NULL,
  views              integer NOT NULL DEFAULT 0,
  reach              integer NOT NULL DEFAULT 0,
  non_follower_reach integer NOT NULL DEFAULT 0,
  accounts_engaged   integer NOT NULL DEFAULT 0,
  profile_visits     integer NOT NULL DEFAULT 0,
  link_clicks        integer NOT NULL DEFAULT 0,
  follows            integer NOT NULL DEFAULT 0,
  unfollows          integer NOT NULL DEFAULT 0,
  followers_total    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, metric_date)
);

-- Campaigns --------------------------------------------------
CREATE TABLE IF NOT EXISTS social_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  goal_metric text,
  goal_value  numeric,
  -- Per-campaign styling, as a theme slot rather than a colour.
  accent_slot smallint NOT NULL DEFAULT 1 CHECK (accent_slot BETWEEN 1 AND 8),
  notes       text,
  is_sample   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS social_campaign_pillars (
  campaign_id uuid NOT NULL REFERENCES social_campaigns(id) ON DELETE CASCADE,
  pillar_id   uuid NOT NULL REFERENCES content_pillars(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, pillar_id)
);

-- RLS --------------------------------------------------------
-- Reads go through the service client in server components, same as
-- the rest of the marketing module. Nothing here is readable by the
-- anon key.
ALTER TABLE social_accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pillars              ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_pillars                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_metrics_daily    ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_account_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_campaigns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_campaign_pillars      ENABLE ROW LEVEL SECURITY;

-- Seed the pillars Geoff named, plus a bucket for the unclassified.
-- color_slot is a theme slot; see the note at the top of this file.
INSERT INTO content_pillars (slug, name, color_slot, sort_order) VALUES
  ('yoga',                 'Yoga',                   2, 10),
  ('yoga-teacher-training','Yoga Teacher Training',  1, 20),
  ('ecolodge-adventure',   'Ecolodge & Adventure',   3, 30),
  ('wellness',             'Wellness',               6, 40),
  ('biohacking',           'Biohacking',             7, 50),
  ('unclassified',         'Unclassified',           5, 999)
ON CONFLICT (slug) DO NOTHING;
