-- AO Platform: People, Roles, Property & Workforce schema overhaul
-- Migration 00003
-- Builds Ring 0 (People & Roles), Ring 1a (Property), Ring 1b (Workforce)
-- Migrates data from profiles → persons, practitioners → person system

-- ============================================================
-- PHASE A: NEW ENUMS
-- ============================================================

CREATE TYPE person_role_status AS ENUM ('active', 'suspended', 'expired');
CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract', 'volunteer', 'seasonal');
CREATE TYPE bed_type AS ENUM ('single', 'double', 'queen', 'king', 'bunk_top', 'bunk_bottom');
CREATE TYPE facility_type AS ENUM ('yoga_deck', 'spa_room', 'pool', 'kitchen', 'gift_shop', 'event_space', 'other');
CREATE TYPE service_domain AS ENUM ('spa', 'yoga', 'excursion', 'education', 'activity', 'other');
CREATE TYPE vendor_type_enum AS ENUM ('art', 'food', 'crafts', 'services', 'other');
CREATE TYPE role_category AS ENUM (
  'ownership', 'management', 'staff_front', 'staff_kitchen',
  'staff_housekeeping', 'staff_admin', 'wellness', 'education',
  'activity_provider', 'guest', 'external', 'vendor', 'volunteer'
);


-- ============================================================
-- PHASE B: RING 0 — PERSONS & ROLES
-- ============================================================

-- Central identity table — one row per human
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  access_level INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_persons_email ON persons(email);
CREATE INDEX idx_persons_auth_user ON persons(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_persons_access_level ON persons(access_level);
CREATE INDEX idx_persons_active ON persons(is_active);

-- Roles catalog — admin-manageable, not an enum
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category role_category NOT NULL,
  access_level INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Person-to-role junction — many roles per person, time-bounded
CREATE TABLE person_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status person_role_status NOT NULL DEFAULT 'active',
  starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_at DATE,
  employment_type employment_type,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_end_before_start CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX idx_person_roles_person ON person_roles(person_id);
CREATE INDEX idx_person_roles_role ON person_roles(role_id);
CREATE INDEX idx_person_roles_active ON person_roles(person_id, status) WHERE status = 'active';

-- Role-specific detail tables

CREATE TABLE staff_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_role_id UUID NOT NULL UNIQUE REFERENCES person_roles(id) ON DELETE CASCADE,
  department TEXT,
  position TEXT,
  hourly_rate NUMERIC(10,2),
  monthly_salary NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  manager_person_id UUID REFERENCES persons(id),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE practitioner_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_role_id UUID NOT NULL UNIQUE REFERENCES person_roles(id) ON DELETE CASCADE,
  specialties TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT ARRAY['en'],
  bio TEXT,
  hourly_rate NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_bookable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendor_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_role_id UUID NOT NULL UNIQUE REFERENCES person_roles(id) ON DELETE CASCADE,
  business_name TEXT,
  vendor_type vendor_type_enum NOT NULL DEFAULT 'other',
  commission_rate NUMERIC(5,2),
  tax_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guest_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_role_id UUID NOT NULL UNIQUE REFERENCES person_roles(id) ON DELETE CASCADE,
  dietary_restrictions TEXT,
  accessibility_needs TEXT,
  preferences JSONB DEFAULT '{}'::JSONB,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- PHASE C: RING 1a — PROPERTY
-- ============================================================

-- Enhance rooms with location info
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS building TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor INT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS location_notes TEXT;

-- Individual bed units within rooms
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  bed_type bed_type NOT NULL DEFAULT 'single',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_beds_room ON beds(room_id);
CREATE INDEX idx_beds_active ON beds(is_active);

-- Time-bounded bed configuration overrides (variance system)
CREATE TABLE bed_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  override_bed_type bed_type NOT NULL,
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT config_dates CHECK (ends_at >= starts_at)
);

CREATE INDEX idx_bed_configs_bed ON bed_configurations(bed_id);
CREATE INDEX idx_bed_configs_dates ON bed_configurations(starts_at, ends_at);

-- Non-room bookable spaces
CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  facility_type facility_type NOT NULL,
  description TEXT,
  capacity INT,
  is_bookable BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Date-level pricing/availability overrides for rooms
CREATE TABLE room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  override_rate NUMERIC(10,2),
  override_currency TEXT,
  block_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_room_date UNIQUE (room_id, date)
);

CREATE INDEX idx_room_avail_room_date ON room_availability(room_id, date);
CREATE INDEX idx_room_avail_date ON room_availability(date);


-- ============================================================
-- PHASE D: RING 1b — WORKFORCE
-- ============================================================

-- Staff availability — date/time per person
CREATE TABLE staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT avail_times CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX idx_staff_avail_person ON staff_availability(person_id);
CREATE INDEX idx_staff_avail_date ON staff_availability(date);

-- Generalized service catalog (extends beyond spa_services)
CREATE TABLE service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain service_domain NOT NULL DEFAULT 'spa',
  category_id UUID,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  max_participants INT NOT NULL DEFAULT 1,
  is_addon BOOLEAN NOT NULL DEFAULT false,
  contraindications TEXT,
  preparation_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_catalog_domain ON service_catalog(domain);
CREATE INDEX idx_service_catalog_active ON service_catalog(is_active);

-- Which persons can deliver which services
CREATE TABLE service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  custom_rate NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_provider_service UNIQUE (person_id, service_id)
);

CREATE INDEX idx_service_providers_person ON service_providers(person_id);
CREATE INDEX idx_service_providers_service ON service_providers(service_id);


-- ============================================================
-- PHASE E: ACCESS LEVEL COMPUTATION
-- ============================================================

CREATE OR REPLACE FUNCTION compute_access_level(p_person_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(
    (SELECT MAX(r.access_level)
     FROM person_roles pr
     JOIN roles r ON r.id = pr.role_id
     WHERE pr.person_id = p_person_id
       AND pr.status = 'active'
       AND (pr.ends_at IS NULL OR pr.ends_at >= CURRENT_DATE)
       AND pr.starts_at <= CURRENT_DATE),
    1
  );
$$ LANGUAGE sql STABLE;

-- Auto-recompute access_level when person_roles change
CREATE OR REPLACE FUNCTION sync_person_access_level()
RETURNS TRIGGER AS $$
DECLARE
  target_person_id UUID;
BEGIN
  target_person_id := COALESCE(NEW.person_id, OLD.person_id);
  UPDATE persons
    SET access_level = compute_access_level(target_person_id),
        updated_at = now()
    WHERE id = target_person_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER person_roles_access_sync
  AFTER INSERT OR UPDATE OR DELETE ON person_roles
  FOR EACH ROW EXECUTE FUNCTION sync_person_access_level();

-- Helper for RLS: get current user's access level
CREATE OR REPLACE FUNCTION current_user_access_level()
RETURNS INT AS $$
  SELECT COALESCE(
    (SELECT access_level FROM persons WHERE auth_user_id = auth.uid()),
    0
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Updated_at triggers for new tables
CREATE TRIGGER persons_updated_at BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER person_roles_updated_at BEFORE UPDATE ON person_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER staff_details_updated_at BEFORE UPDATE ON staff_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER practitioner_details_updated_at BEFORE UPDATE ON practitioner_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vendor_details_updated_at BEFORE UPDATE ON vendor_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER guest_details_updated_at BEFORE UPDATE ON guest_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER beds_updated_at BEFORE UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER facilities_updated_at BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER service_catalog_updated_at BEFORE UPDATE ON service_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- PHASE F: SEED ROLES CATALOG
-- ============================================================

INSERT INTO roles (slug, name, description, category, access_level, sort_order) VALUES
  -- Ownership
  ('owner',              'Owner',                 'Property owner with full access',          'ownership',          6,  1),
  -- Management
  ('admin',              'Administrator',         'Full administrative access',               'management',         5,  2),
  ('manager',            'Manager',               'Operational management access',            'management',         4,  3),
  -- Front of House
  ('receptionist',       'Receptionist',          'Front desk and guest services',            'staff_front',        3,  4),
  ('concierge',          'Concierge',             'Guest experience coordination',            'staff_front',        3,  5),
  ('transport_coord',    'Transport Coordinator', 'Airport transfers and logistics',          'staff_front',        3,  6),
  -- Kitchen
  ('chef',               'Chef',                  'Kitchen management and cooking',           'staff_kitchen',      3,  7),
  ('kitchen_staff',      'Kitchen Staff',         'Kitchen support and food prep',            'staff_kitchen',      3,  8),
  -- Housekeeping
  ('housekeeper',        'Housekeeper',           'Room cleaning and maintenance',            'staff_housekeeping', 3,  9),
  ('maintenance',        'Maintenance',           'Property maintenance and repairs',         'staff_housekeeping', 3, 10),
  -- Admin Staff
  ('bookkeeper',         'Bookkeeper',            'Financial record keeping',                 'staff_admin',        3, 11),
  ('staff_general',      'General Staff',         'General staff member',                     'staff_admin',        3, 12),
  -- Wellness
  ('massage_therapist',  'Massage Therapist',     'Licensed massage therapy',                 'wellness',           3, 13),
  ('yoga_teacher',       'Yoga Teacher',          'Yoga and meditation instruction',          'wellness',           3, 14),
  ('energy_healer',      'Energy Healer',         'Reiki, craniosacral, energy work',         'wellness',           3, 15),
  ('esthetician',        'Esthetician',           'Skin care and facial treatments',          'wellness',           3, 16),
  ('practitioner',       'Practitioner',          'General wellness practitioner',            'wellness',           3, 17),
  -- Education
  ('facilitator',        'Retreat Facilitator',   'Retreat program facilitation',             'education',          3, 18),
  ('instructor',         'Instructor',            'Class or workshop instruction',            'education',          3, 19),
  -- Activities
  ('tour_guide',         'Tour Guide',            'Excursions and local tours',               'activity_provider',  3, 20),
  ('surf_instructor',    'Surf Instructor',       'Surfing lessons',                          'activity_provider',  3, 21),
  -- Guest
  ('guest',              'Guest',                 'Retreat or hotel guest',                   'guest',              1, 22),
  -- External
  ('retreat_leader',     'Retreat Leader',        'External retreat organizer',               'external',           2, 23),
  ('collaborator',       'Collaborator',          'External collaborator with limited access','external',           2, 24),
  -- Vendor
  ('vendor_art',         'Art Vendor',            'Art gallery or art sales',                 'vendor',             2, 25),
  ('vendor_food',        'Food Vendor',           'External food/beverage vendor',            'vendor',             2, 26),
  ('vendor_services',    'Service Vendor',        'External service provider',                'vendor',             2, 27),
  -- Volunteer
  ('volunteer',          'Volunteer',             'Work-exchange volunteer',                  'volunteer',          2, 28)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- PHASE G: DATA MIGRATION
-- ============================================================

-- 1. Migrate profiles → persons (preserve IDs for FK continuity)
INSERT INTO persons (id, auth_user_id, email, full_name, phone, avatar_url,
                     preferred_language, preferred_currency, access_level,
                     created_at, updated_at)
SELECT id, id, email,
       COALESCE(full_name, ''),
       phone, avatar_url,
       preferred_language, preferred_currency,
       CASE role
         WHEN 'owner' THEN 6
         WHEN 'admin' THEN 5
         WHEN 'manager' THEN 4
         WHEN 'staff' THEN 3
         ELSE 1
       END,
       created_at, updated_at
FROM profiles
ON CONFLICT (id) DO NOTHING;

-- 2. Create person_roles from old profile roles
INSERT INTO person_roles (person_id, role_id, status, starts_at)
SELECT p.id,
       r.id,
       'active',
       CURRENT_DATE
FROM profiles p_old
JOIN persons p ON p.id = p_old.id
JOIN roles r ON r.slug = CASE p_old.role::TEXT
  WHEN 'owner' THEN 'owner'
  WHEN 'admin' THEN 'admin'
  WHEN 'manager' THEN 'manager'
  WHEN 'staff' THEN 'staff_general'
  ELSE 'guest'
END
ON CONFLICT DO NOTHING;

-- 3. Migrate practitioners without profile_id → new persons
INSERT INTO persons (email, full_name, is_active, created_at, updated_at)
SELECT
  LOWER(REPLACE(REPLACE(pr.full_name, ' ', '.'), '''', '')) || '@placeholder.local',
  pr.full_name,
  pr.is_active,
  pr.created_at,
  pr.updated_at
FROM practitioners pr
WHERE pr.profile_id IS NULL
ON CONFLICT (email) DO NOTHING;

-- 4. Create practitioner role assignments
INSERT INTO person_roles (person_id, role_id, status, starts_at)
SELECT
  COALESCE(
    (SELECT pe.id FROM persons pe WHERE pe.auth_user_id = prac.profile_id),
    (SELECT pe.id FROM persons pe WHERE pe.full_name = prac.full_name LIMIT 1)
  ),
  (SELECT r.id FROM roles r WHERE r.slug = 'practitioner'),
  CASE WHEN prac.is_active THEN 'active'::person_role_status ELSE 'expired'::person_role_status END,
  prac.created_at::DATE
FROM practitioners prac
WHERE COALESCE(
  (SELECT pe.id FROM persons pe WHERE pe.auth_user_id = prac.profile_id),
  (SELECT pe.id FROM persons pe WHERE pe.full_name = prac.full_name LIMIT 1)
) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Create practitioner_details for migrated practitioners
INSERT INTO practitioner_details (person_role_id, specialties, languages, bio)
SELECT
  pr_role.id,
  prac.specialties,
  prac.languages,
  prac.bio
FROM practitioners prac
JOIN persons pe ON pe.full_name = prac.full_name
JOIN person_roles pr_role ON pr_role.person_id = pe.id
  AND pr_role.role_id = (SELECT r.id FROM roles r WHERE r.slug = 'practitioner')
ON CONFLICT DO NOTHING;

-- 6. Migrate spa_services → service_catalog
INSERT INTO service_catalog (domain, category_id, slug, name, description,
  duration_minutes, price, currency, is_addon, contraindications,
  preparation_notes, is_active, sort_order, created_at, updated_at)
SELECT 'spa'::service_domain, category_id, slug, name, description,
  duration_minutes, price, currency, is_addon, contraindications,
  preparation_notes, is_active, sort_order, created_at, updated_at
FROM spa_services
ON CONFLICT (slug) DO NOTHING;

-- 7. Migrate practitioner_services → service_providers
INSERT INTO service_providers (person_id, service_id, is_active)
SELECT
  COALESCE(
    (SELECT pe.id FROM persons pe WHERE pe.auth_user_id = prac.profile_id),
    (SELECT pe.id FROM persons pe WHERE pe.full_name = prac.full_name LIMIT 1)
  ),
  (SELECT sc.id FROM service_catalog sc WHERE sc.slug = ss.slug),
  true
FROM practitioner_services ps
JOIN practitioners prac ON prac.id = ps.practitioner_id
JOIN spa_services ss ON ss.id = ps.spa_service_id
WHERE (SELECT sc.id FROM service_catalog sc WHERE sc.slug = ss.slug) IS NOT NULL
ON CONFLICT (person_id, service_id) DO NOTHING;


-- ============================================================
-- PHASE H: UPDATE FOREIGN KEYS ON EXISTING TABLES
-- ============================================================

-- Bookings: add person_id pointing to persons
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id);

UPDATE bookings b
SET person_id = b.profile_id
WHERE b.person_id IS NULL;

-- Leads: add assigned_to_person pointing to persons
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_person UUID REFERENCES persons(id);

UPDATE leads l
SET assigned_to_person = l.assigned_to
WHERE l.assigned_to IS NOT NULL AND l.assigned_to_person IS NULL;


-- ============================================================
-- PHASE I: REPLACE AUTH TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.persons (auth_user_id, email, full_name, access_level)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    1
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PHASE J: RLS POLICIES FOR NEW TABLES
-- ============================================================

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioner_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

-- Persons: read own + staff+ read all
CREATE POLICY persons_select ON persons FOR SELECT USING (
  auth_user_id = auth.uid() OR current_user_access_level() >= 3
);
CREATE POLICY persons_update_own ON persons FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY persons_admin_all ON persons FOR ALL USING (current_user_access_level() >= 5);

-- Roles: any authenticated reads, admin+ writes
CREATE POLICY roles_select ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_admin ON roles FOR ALL USING (current_user_access_level() >= 5);

-- Person roles: read own + staff+ read all, admin+ write
CREATE POLICY person_roles_select ON person_roles FOR SELECT USING (
  person_id IN (SELECT id FROM persons WHERE auth_user_id = auth.uid())
  OR current_user_access_level() >= 3
);
CREATE POLICY person_roles_admin ON person_roles FOR ALL USING (current_user_access_level() >= 5);

-- Detail tables: read own + staff+ read all, admin+ write
CREATE POLICY staff_details_select ON staff_details FOR SELECT USING (
  person_role_id IN (
    SELECT pr.id FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id
    WHERE p.auth_user_id = auth.uid()
  ) OR current_user_access_level() >= 3
);
CREATE POLICY staff_details_admin ON staff_details FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY practitioner_details_select ON practitioner_details FOR SELECT USING (
  person_role_id IN (
    SELECT pr.id FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id
    WHERE p.auth_user_id = auth.uid()
  ) OR current_user_access_level() >= 3
);
CREATE POLICY practitioner_details_admin ON practitioner_details FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY vendor_details_select ON vendor_details FOR SELECT USING (
  person_role_id IN (
    SELECT pr.id FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id
    WHERE p.auth_user_id = auth.uid()
  ) OR current_user_access_level() >= 3
);
CREATE POLICY vendor_details_admin ON vendor_details FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY guest_details_select ON guest_details FOR SELECT USING (
  person_role_id IN (
    SELECT pr.id FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id
    WHERE p.auth_user_id = auth.uid()
  ) OR current_user_access_level() >= 3
);
CREATE POLICY guest_details_admin ON guest_details FOR ALL USING (current_user_access_level() >= 5);

-- Property tables: any authenticated reads, admin+ writes
CREATE POLICY beds_select ON beds FOR SELECT TO authenticated USING (true);
CREATE POLICY beds_admin ON beds FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY bed_configs_select ON bed_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY bed_configs_admin ON bed_configurations FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY facilities_select ON facilities FOR SELECT TO authenticated USING (true);
CREATE POLICY facilities_admin ON facilities FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY room_avail_select ON room_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY room_avail_admin ON room_availability FOR ALL USING (current_user_access_level() >= 5);

-- Workforce tables
CREATE POLICY staff_avail_select ON staff_availability FOR SELECT USING (
  person_id IN (SELECT id FROM persons WHERE auth_user_id = auth.uid())
  OR current_user_access_level() >= 3
);
CREATE POLICY staff_avail_own ON staff_availability FOR INSERT WITH CHECK (
  person_id IN (SELECT id FROM persons WHERE auth_user_id = auth.uid())
);
CREATE POLICY staff_avail_admin ON staff_availability FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY service_catalog_select ON service_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY service_catalog_admin ON service_catalog FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY service_providers_select ON service_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY service_providers_admin ON service_providers FOR ALL USING (current_user_access_level() >= 5);
