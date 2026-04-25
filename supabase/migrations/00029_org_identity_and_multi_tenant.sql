-- ============================================================
-- 00029: Organization identity, properties (sub-brands),
-- per-org AI provider config, brand guide visibility
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. ORGANIZATION IDENTITY FIELDS
-- These power getOrganizationContext() on the website side
-- ══════════════════════════════════════════════════════════════

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry text DEFAULT 'hospitality';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_offering text DEFAULT 'yoga retreat';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en-US';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Costa_Rica';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_url text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sensitive_topics jsonb DEFAULT '["prices","dates","availability"]'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS disclaimers jsonb DEFAULT '{}'::jsonb;
  -- Structure: { "booking": "text or empty", "medical": "text or empty", "legal": "text or empty" }
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS visitor_agent_enabled boolean DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS visitor_agent_brand_guide_id uuid;
  -- Which brand guide drives the visitor-facing agent's tone (may differ from admin tools)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS visitor_agent_question_templates jsonb DEFAULT '{}'::jsonb;
  -- Keyed by post type: { "service": ["What's included?","How much?"], "event": ["When?","How to sign up?"] }

-- FK for visitor agent brand guide
DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_visitor_agent_brand_guide_fkey
    FOREIGN KEY (visitor_agent_brand_guide_id) REFERENCES ai_brand_guide(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2. PROPERTIES (SUB-BRANDS)
-- An organization can operate multiple physical locations,
-- each potentially with its own website, retreats, rooms, staff
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  property_type text DEFAULT 'retreat_center',
    -- 'retreat_center', 'hotel', 'boutique_hotel', 'resort', 'wellness_center',
    -- 'yoga_studio', 'spa', 'event_venue', 'other'
  property_type_custom text,

  -- Identity (can override parent org for this property's website)
  tagline text,
  industry text,
  primary_offering text,
  locale text,
  timezone text,
  booking_url text,
  contact_url text,

  -- Location
  address_line1 text,
  address_line2 text,
  city text,
  state_province text,
  country text,
  postal_code text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  nearest_airport text,

  -- Contact
  phone text,
  email text,
  website_url text,

  -- Settings
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_org_properties_org ON org_properties(org_id);

ALTER TABLE org_properties ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON org_properties FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read active" ON org_properties FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optional FK: link retreats to a specific property
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS property_id uuid;
DO $$ BEGIN
  ALTER TABLE retreats
    ADD CONSTRAINT retreats_property_fkey
    FOREIGN KEY (property_id) REFERENCES org_properties(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_retreats_property ON retreats(property_id) WHERE property_id IS NOT NULL;

-- Optional FK: link rooms to a specific property
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS property_id uuid;
DO $$ BEGIN
  ALTER TABLE rooms
    ADD CONSTRAINT rooms_property_fkey
    FOREIGN KEY (property_id) REFERENCES org_properties(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id) WHERE property_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- 3. PER-ORG AI PROVIDER CONFIG
-- Scopes provider access, API keys, and model roles per tenant
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_ai_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,

  -- Key management
  has_key boolean DEFAULT false,
  -- API keys are NOT stored here — they stay in env vars or a secrets manager.
  -- This table tracks which orgs have configured which providers.
  -- For platform-provided keys: has_key = true, key_source = 'platform'
  -- For tenant-provided keys: has_key = true, key_source = 'tenant'
  key_source text DEFAULT 'platform', -- 'platform', 'tenant'

  -- Model role assignments for this org
  -- Which model fills best/fastest/standard for text and image
  role_best_text text,     -- model endpoint string, e.g. 'gpt-5.4'
  role_fastest_text text,  -- e.g. 'gpt-5.4-nano'
  role_best_image text,    -- e.g. 'gpt-image-1'

  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(org_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_org_ai_config_org ON org_ai_provider_config(org_id);

ALTER TABLE org_ai_provider_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON org_ai_provider_config FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- No anon read — API key metadata should not be public

-- ══════════════════════════════════════════════════════════════
-- 4. BRAND GUIDE VISIBILITY FLAG
-- Controls whether a guide is for admin tools, visitor agent, or both
-- ══════════════════════════════════════════════════════════════

ALTER TABLE ai_brand_guide ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'admin_only';
  -- 'admin_only'  — only for internal content tools (rewrite, headline, etc.)
  -- 'public'      — available for visitor-facing agent
  -- 'both'        — used by both

-- ══════════════════════════════════════════════════════════════
-- 5. ANON READ POLICIES FOR WEBSITE CONSUMPTION
-- The website reads org identity via anon key
-- ══════════════════════════════════════════════════════════════

-- Organizations — anon can read active orgs (for getOrganizationContext)
DO $$ BEGIN
  CREATE POLICY "Anon read active orgs" ON organizations FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
