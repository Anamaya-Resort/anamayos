-- ============================================================
-- Migration 00012: Guest Folio System
-- Tax rates, line item taxes, signature/approval on line items
-- ============================================================

-- ============================================================
-- 1. TAX RATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS tax_rates (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  rate           NUMERIC(6,4) NOT NULL,              -- e.g. 0.1300 = 13%
  is_compound    BOOLEAN DEFAULT false,               -- compound = tax-on-tax
  applies_to     TEXT[] DEFAULT '{}',                  -- product_category slugs; empty = all
  is_active      BOOLEAN DEFAULT true,
  sort_order     INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_tax_rates_active ON tax_rates (is_active, sort_order);

CREATE TRIGGER trg_tax_rates_updated_at
  BEFORE UPDATE ON tax_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed Costa Rica IVA (13%) — applies to everything
INSERT INTO tax_rates (slug, name, rate, is_compound, applies_to, sort_order) VALUES
  ('iva', 'IVA', 0.1300, false, '{}', 10);

-- Example: optional service charge (off by default)
INSERT INTO tax_rates (slug, name, rate, is_compound, applies_to, is_active, sort_order) VALUES
  ('service-charge', 'Service Charge', 0.1000, false, ARRAY['spa','yoga','longevity'], false, 20);

-- ============================================================
-- 2. APPROVAL / SIGNATURE COLUMNS ON BOOKING_LINE_ITEMS
-- ============================================================

ALTER TABLE booking_line_items
  ADD COLUMN IF NOT EXISTS approved_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_signature     TEXT,            -- base64 PNG data
  ADD COLUMN IF NOT EXISTS approved_location_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_location_coords TEXT,          -- "lat,lng"
  ADD COLUMN IF NOT EXISTS approved_by_person_id  UUID REFERENCES persons(id),
  ADD COLUMN IF NOT EXISTS approval_method        TEXT CHECK (approval_method IN ('self', 'staff_presented'));

CREATE INDEX idx_bli_approved ON booking_line_items (approved_at) WHERE approved_at IS NOT NULL;

-- ============================================================
-- 3. LINE ITEM TAXES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS line_item_taxes (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_item_id   UUID NOT NULL REFERENCES booking_line_items(id) ON DELETE CASCADE,
  tax_rate_id    UUID NOT NULL REFERENCES tax_rates(id),
  tax_name       TEXT NOT NULL,                       -- snapshot at creation time
  tax_rate       NUMERIC(6,4) NOT NULL,               -- snapshot at creation time
  tax_amount     NUMERIC(10,2) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_lit_line_item ON line_item_taxes (line_item_id);
CREATE INDEX idx_lit_tax_rate  ON line_item_taxes (tax_rate_id);

CREATE TRIGGER trg_line_item_taxes_updated_at
  BEFORE UPDATE ON line_item_taxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_item_taxes ENABLE ROW LEVEL SECURITY;

-- Tax rates: everyone authenticated can read, admin+ can write
CREATE POLICY tax_rates_select ON tax_rates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tax_rates_admin ON tax_rates
  FOR ALL TO authenticated
  USING (current_user_access_level() >= 5)
  WITH CHECK (current_user_access_level() >= 5);

-- Line item taxes: same access as booking_line_items
-- Guest sees own booking's taxes, staff+ sees all, staff+ writes
CREATE POLICY lit_select_own ON line_item_taxes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_line_items bli
      JOIN bookings b ON b.id = bli.booking_id
      WHERE bli.id = line_item_taxes.line_item_id
        AND b.person_id = (SELECT id FROM persons WHERE auth_user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY lit_select_staff ON line_item_taxes
  FOR SELECT TO authenticated
  USING (current_user_access_level() >= 3);

CREATE POLICY lit_staff_write ON line_item_taxes
  FOR ALL TO authenticated
  USING (current_user_access_level() >= 3)
  WITH CHECK (current_user_access_level() >= 3);
