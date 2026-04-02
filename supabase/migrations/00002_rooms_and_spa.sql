-- AO Platform: Rooms, room types, spa services, and practitioners
-- These are configurable catalog tables, not hard-coded business logic.

-- Room categories / tiers
CREATE TABLE room_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual rooms / accommodation units
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES room_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  max_occupancy INT NOT NULL DEFAULT 2,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  base_rate_per_night NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  amenities JSONB DEFAULT '[]'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spa service categories
CREATE TABLE spa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spa treatments / services
CREATE TABLE spa_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES spa_categories(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_addon BOOLEAN NOT NULL DEFAULT false,
  contraindications TEXT,
  preparation_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Practitioners
CREATE TABLE practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  full_name TEXT NOT NULL,
  bio TEXT,
  languages TEXT[] DEFAULT ARRAY['en'],
  specialties TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: which practitioners offer which services
CREATE TABLE practitioner_services (
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  spa_service_id UUID NOT NULL REFERENCES spa_services(id) ON DELETE CASCADE,
  PRIMARY KEY (practitioner_id, spa_service_id)
);

-- Indexes
CREATE INDEX idx_rooms_category ON rooms(category_id);
CREATE INDEX idx_rooms_active ON rooms(is_active);
CREATE INDEX idx_spa_services_category ON spa_services(category_id);
CREATE INDEX idx_spa_services_active ON spa_services(is_active);

-- RLS
ALTER TABLE room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioner_services ENABLE ROW LEVEL SECURITY;

-- Catalog tables: readable by any authenticated user, writable by admin+
CREATE POLICY room_categories_select ON room_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY rooms_select ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY spa_categories_select ON spa_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY spa_services_select ON spa_services FOR SELECT TO authenticated USING (true);
CREATE POLICY practitioners_select ON practitioners FOR SELECT TO authenticated USING (true);
CREATE POLICY practitioner_services_select ON practitioner_services FOR SELECT TO authenticated USING (true);

-- Admin write policies
CREATE POLICY room_categories_admin ON room_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY rooms_admin ON rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY spa_categories_admin ON spa_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY spa_services_admin ON spa_services FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY practitioners_admin ON practitioners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY practitioner_services_admin ON practitioner_services FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Updated_at triggers
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER spa_services_updated_at BEFORE UPDATE ON spa_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER practitioners_updated_at BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
