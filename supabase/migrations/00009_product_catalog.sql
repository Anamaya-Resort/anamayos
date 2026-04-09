-- AO Platform: Unified Product Catalog, Booking Line Items, Packages
-- Migration 00009

-- ============================================================
-- PHASE A: NEW ENUMS
-- ============================================================

CREATE TYPE product_type AS ENUM (
  'accommodation', 'service', 'activity', 'item',
  'rental', 'transfer', 'package', 'gift_certificate'
);

CREATE TYPE line_item_status AS ENUM (
  'pending', 'confirmed', 'scheduled', 'in_progress',
  'completed', 'cancelled', 'no_show'
);

-- ============================================================
-- PHASE B: PRODUCT CATEGORIES (hierarchical, multi-category)
-- ============================================================

CREATE TABLE product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_product_categories_active ON product_categories(is_active);

-- ============================================================
-- PHASE C: PRODUCTS TABLE
-- ============================================================

CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type        product_type NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  short_description   TEXT,
  base_price          NUMERIC(10,2),
  currency            TEXT NOT NULL DEFAULT 'USD',
  duration_minutes    INT,
  max_participants    INT DEFAULT 1,
  requires_provider   BOOLEAN NOT NULL DEFAULT false,
  is_addon            BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INT NOT NULL DEFAULT 0,
  capacity_per_slot   INT,
  service_catalog_id  UUID,
  images              JSONB DEFAULT '[]'::JSONB,
  metadata            JSONB DEFAULT '{}'::JSONB,
  contraindications   TEXT,
  preparation_notes   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_slug ON products(slug);

-- ============================================================
-- PHASE D: PRODUCT-CATEGORY JUNCTION (many-to-many)
-- ============================================================

CREATE TABLE product_category_map (
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_pcm_category ON product_category_map(category_id);
CREATE INDEX idx_pcm_product ON product_category_map(product_id);

-- ============================================================
-- PHASE E: PRODUCT VARIANTS
-- ============================================================

CREATE TABLE product_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  duration_minutes INT,
  description      TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_variant_slug UNIQUE (product_id, slug)
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);

-- ============================================================
-- PHASE F: PACKAGE ITEMS
-- ============================================================

CREATE TABLE package_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity        INT NOT NULL DEFAULT 1,
  is_included     BOOLEAN NOT NULL DEFAULT true,
  is_optional     BOOLEAN NOT NULL DEFAULT false,
  addon_price     NUMERIC(10,2) DEFAULT 0,
  sort_order      INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT package_not_self CHECK (package_id != product_id)
);

CREATE INDEX idx_package_items_package ON package_items(package_id);
CREATE INDEX idx_package_items_product ON package_items(product_id);

-- ============================================================
-- PHASE G: PRODUCT PROVIDERS
-- ============================================================

CREATE TABLE product_providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  custom_rate NUMERIC(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_product_provider UNIQUE (product_id, person_id)
);

CREATE INDEX idx_product_providers_product ON product_providers(product_id);
CREATE INDEX idx_product_providers_person ON product_providers(person_id);

-- ============================================================
-- PHASE H: BOOKING LINE ITEMS
-- ============================================================

CREATE TABLE booking_line_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  variant_id          UUID REFERENCES product_variants(id),
  person_id           UUID REFERENCES persons(id),
  provider_id         UUID REFERENCES persons(id),
  facility_id         UUID REFERENCES facilities(id),
  quantity            INT NOT NULL DEFAULT 1,
  unit_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'USD',
  status              line_item_status NOT NULL DEFAULT 'pending',
  scheduled_date      DATE,
  scheduled_start     TIME,
  scheduled_end       TIME,
  package_item_id     UUID REFERENCES package_items(id),
  parent_line_item_id UUID REFERENCES booking_line_items(id),
  notes               TEXT,
  guest_notes         TEXT,
  staff_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bli_booking ON booking_line_items(booking_id);
CREATE INDEX idx_bli_product ON booking_line_items(product_id);
CREATE INDEX idx_bli_person ON booking_line_items(person_id);
CREATE INDEX idx_bli_provider ON booking_line_items(provider_id);
CREATE INDEX idx_bli_status ON booking_line_items(status);
CREATE INDEX idx_bli_scheduled ON booking_line_items(scheduled_date);
CREATE INDEX idx_bli_parent ON booking_line_items(parent_line_item_id)
  WHERE parent_line_item_id IS NOT NULL;

-- ============================================================
-- PHASE I: ENHANCE BOOKING PARTICIPANTS
-- ============================================================

ALTER TABLE booking_participants
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id);

ALTER TABLE booking_participants
  ADD COLUMN IF NOT EXISTS arrival_date DATE,
  ADD COLUMN IF NOT EXISTS departure_date DATE,
  ADD COLUMN IF NOT EXISTS arrival_time TIME,
  ADD COLUMN IF NOT EXISTS departure_time TIME,
  ADD COLUMN IF NOT EXISTS arrival_flight TEXT,
  ADD COLUMN IF NOT EXISTS departure_flight TEXT,
  ADD COLUMN IF NOT EXISTS transport_arrival TEXT,
  ADD COLUMN IF NOT EXISTS transport_departure TEXT,
  ADD COLUMN IF NOT EXISTS arrival_notes TEXT,
  ADD COLUMN IF NOT EXISTS departure_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_participants_person
  ON booking_participants(person_id) WHERE person_id IS NOT NULL;

-- ============================================================
-- PHASE J: SEED PRODUCT CATEGORIES
-- ============================================================

-- Top-level categories
INSERT INTO product_categories (slug, name, description, sort_order) VALUES
  ('spa',           'Spa & Wellness',         'Massage, bodywork, and healing treatments', 1),
  ('yoga',          'Yoga & Meditation',      'Yoga classes, workshops, and private sessions', 2),
  ('longevity',     'Longevity & Biohacking', 'Compression boots, red light therapy, cold plunge', 3),
  ('excursions',    'Excursions & Tours',     'Local tours, surfing, waterfall hikes', 4),
  ('activities',    'Activities',             'On-site activities and entertainment', 5),
  ('accommodation', 'Accommodation',          'Rooms and lodging options', 6),
  ('transfers',     'Transfers',              'Airport and local transportation', 7),
  ('packages',      'Packages & Retreats',    'Bundled retreat and vacation packages', 8),
  ('gifts',         'Gift Certificates',      'Gift certificates and vouchers', 9)
ON CONFLICT (slug) DO NOTHING;

-- Spa sub-categories (from existing spa_categories)
INSERT INTO product_categories (parent_id, slug, name, description, sort_order)
SELECT
  (SELECT id FROM product_categories WHERE slug = 'spa'),
  'spa-' || sc.slug,
  sc.name,
  sc.description,
  sc.sort_order
FROM spa_categories sc
ON CONFLICT (slug) DO NOTHING;

-- Longevity sub-categories
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'longevity'), 'longevity-compression', 'Compression Therapy', 'Normatec compression boots and similar', 1),
  ((SELECT id FROM product_categories WHERE slug = 'longevity'), 'longevity-light',       'Light Therapy',       'Red light therapy, infrared sauna', 2),
  ((SELECT id FROM product_categories WHERE slug = 'longevity'), 'longevity-cold',        'Cold Therapy',        'Cold plunge, ice baths', 3),
  ((SELECT id FROM product_categories WHERE slug = 'longevity'), 'longevity-frequency',   'Frequency Therapy',   'Rife, scalar, FSM treatments', 4),
  ((SELECT id FROM product_categories WHERE slug = 'longevity'), 'longevity-oxygen',      'Oxygen Therapy',      'Oxygen therapy, hyperbaric', 5)
ON CONFLICT (slug) DO NOTHING;

-- Yoga sub-categories
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'yoga'), 'yoga-vinyasa',    'Vinyasa Flow',       'Dynamic flowing yoga', 1),
  ((SELECT id FROM product_categories WHERE slug = 'yoga'), 'yoga-yin',        'Yin & Restorative',  'Slow, deep stretching and relaxation', 2),
  ((SELECT id FROM product_categories WHERE slug = 'yoga'), 'yoga-meditation', 'Meditation',         'Guided and silent meditation', 3),
  ((SELECT id FROM product_categories WHERE slug = 'yoga'), 'yoga-private',    'Private Sessions',   'One-on-one yoga instruction', 4),
  ((SELECT id FROM product_categories WHERE slug = 'yoga'), 'yoga-ytt',        'Teacher Training',   'YTT programs and certifications', 5)
ON CONFLICT (slug) DO NOTHING;

-- Excursion sub-categories
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-surf',      'Surfing',        'Surf lessons and trips', 1),
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-water',     'Water Activities','Snorkeling, kayaking, boat tours', 2),
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-adventure', 'Adventure',      'Zipline, ATV, horseback riding', 3),
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-nature',    'Nature & Hiking','Waterfall hikes, wildlife tours', 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- PHASE K: DATA MIGRATION (service_catalog → products)
-- ============================================================

INSERT INTO products (
  product_type, slug, name, description, base_price, currency,
  duration_minutes, max_participants, requires_provider, is_addon,
  is_active, sort_order, service_catalog_id,
  contraindications, preparation_notes, created_at, updated_at
)
SELECT
  'service'::product_type,
  sc.slug, sc.name, sc.description, sc.price, sc.currency,
  sc.duration_minutes, sc.max_participants, true, sc.is_addon,
  sc.is_active, sc.sort_order, sc.id,
  sc.contraindications, sc.preparation_notes, sc.created_at, sc.updated_at
FROM service_catalog sc
ON CONFLICT (slug) DO NOTHING;

-- Map migrated products to spa sub-categories
INSERT INTO product_category_map (product_id, category_id, is_primary)
SELECT
  p.id,
  pc.id,
  true
FROM products p
JOIN service_catalog sc ON sc.id = p.service_catalog_id
JOIN spa_categories spc ON spc.id = sc.category_id
JOIN product_categories pc ON pc.slug = 'spa-' || spc.slug
ON CONFLICT (product_id, category_id) DO NOTHING;

-- Migrate service_providers → product_providers
INSERT INTO product_providers (product_id, person_id, is_primary, is_active)
SELECT p.id, sp.person_id, sp.is_primary, sp.is_active
FROM service_providers sp
JOIN products p ON p.service_catalog_id = sp.service_id
ON CONFLICT (product_id, person_id) DO NOTHING;

-- ============================================================
-- PHASE L: TRIGGERS
-- ============================================================

CREATE TRIGGER product_categories_updated_at BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER booking_line_items_updated_at BEFORE UPDATE ON booking_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- booking_participants may already have this trigger — safe to recreate
DROP TRIGGER IF EXISTS booking_participants_updated_at ON booking_participants;
CREATE TRIGGER booking_participants_updated_at BEFORE UPDATE ON booking_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PHASE M: RLS POLICIES
-- ============================================================

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_line_items ENABLE ROW LEVEL SECURITY;

-- Catalog tables: any authenticated reads, admin+ writes
CREATE POLICY product_categories_select ON product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY product_categories_admin ON product_categories FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY products_select ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_admin ON products FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY pcm_select ON product_category_map FOR SELECT TO authenticated USING (true);
CREATE POLICY pcm_admin ON product_category_map FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY product_variants_select ON product_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY product_variants_admin ON product_variants FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY package_items_select ON package_items FOR SELECT TO authenticated USING (true);
CREATE POLICY package_items_admin ON package_items FOR ALL USING (current_user_access_level() >= 5);

CREATE POLICY product_providers_select ON product_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY product_providers_admin ON product_providers FOR ALL USING (current_user_access_level() >= 5);

-- Booking line items: guest sees own booking's items, staff+ sees all, staff+ writes
CREATE POLICY bli_select ON booking_line_items FOR SELECT USING (
  booking_id IN (SELECT id FROM bookings WHERE person_id IN (
    SELECT id FROM persons WHERE auth_user_id = auth.uid()
  ))
  OR current_user_access_level() >= 3
);
CREATE POLICY bli_staff ON booking_line_items FOR ALL USING (current_user_access_level() >= 3);
