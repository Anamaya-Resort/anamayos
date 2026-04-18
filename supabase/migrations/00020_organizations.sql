-- ============================================================
-- Organizations — multi-tenant foundation
-- ============================================================

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  owner_id    uuid NOT NULL REFERENCES persons(id),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Organization membership
CREATE TABLE org_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id   uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(org_id, person_id)
);

CREATE INDEX idx_org_members_person ON org_members(person_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);

-- Connect branding to organizations
ALTER TABLE org_branding ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

-- ============================================================
-- Organization logos (4 slots: portrait, icon, feature, banner)
-- ============================================================

CREATE TABLE org_logos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slot        text NOT NULL,
  url         text NOT NULL,
  file_name   text NOT NULL,
  file_size   integer,
  mime_type   text,
  width       integer,
  height      integer,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT org_logos_org_slot_unique UNIQUE(org_id, slot)
);

-- ============================================================
-- Organization app graphics (12 slots)
-- ============================================================

CREATE TABLE org_graphics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slot        text NOT NULL,
  url         text NOT NULL,
  file_name   text NOT NULL,
  file_size   integer,
  mime_type   text,
  width       integer,
  height      integer,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT org_graphics_org_slot_unique UNIQUE(org_id, slot)
);

-- ============================================================
-- Superadmin role (level 7)
-- ============================================================

INSERT INTO roles (slug, name, description, category, access_level, sort_order)
VALUES ('superadmin', 'Superadmin', 'Platform-level administrator with access to all organizations', 'ownership', 7, 0)
ON CONFLICT (slug) DO UPDATE SET access_level = 7, sort_order = 0;

-- ============================================================
-- Helper function: get current person's UUID
-- ============================================================

CREATE OR REPLACE FUNCTION current_person_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT id FROM persons WHERE auth_user_id = auth.uid()
$$;

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_graphics ENABLE ROW LEVEL SECURITY;

-- Organizations: superadmins see all, others see orgs they belong to
CREATE POLICY org_select ON organizations FOR SELECT USING (
  current_user_access_level() >= 7
  OR id IN (SELECT org_id FROM org_members WHERE person_id = current_person_id())
);
CREATE POLICY org_write ON organizations FOR ALL USING (current_user_access_level() >= 5);

-- Org members: superadmins see all, members see their own org's members
CREATE POLICY org_members_select ON org_members FOR SELECT USING (
  current_user_access_level() >= 7
  OR org_id IN (SELECT om.org_id FROM org_members om WHERE om.person_id = current_person_id())
);
CREATE POLICY org_members_write ON org_members FOR ALL USING (current_user_access_level() >= 5);

-- Logos and graphics: public read, admin write
CREATE POLICY org_logos_select ON org_logos FOR SELECT USING (true);
CREATE POLICY org_logos_write ON org_logos FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY org_graphics_select ON org_graphics FOR SELECT USING (true);
CREATE POLICY org_graphics_write ON org_graphics FOR ALL USING (current_user_access_level() >= 5);
