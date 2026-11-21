-- ============================================================
-- 00072: Suppliers (excursion + transport companies) and the
-- extra fields excursions and transfers need on products.
--
-- A supplier is a company or independent driver we book directly.
-- Middlemen (agencies reselling someone else's tour) are not listed;
-- we work with each operator directly.
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  legal_name          TEXT,
  -- What they offer: 'excursions', 'transport' (some do both).
  kinds               TEXT[] NOT NULL DEFAULT '{}',
  contact_name        TEXT,
  whatsapp            TEXT,
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  instagram           TEXT,
  address             TEXT,
  -- How reception books: 'whatsapp' | 'email' | 'phone' | 'website'.
  booking_method      TEXT,
  -- Internal notes for reception (billing name, who to ask, etc.).
  booking_notes       TEXT,
  payment_terms       TEXT,
  cancellation_policy TEXT,
  -- Policies that don't fit elsewhere (luggage, children, pets...).
  policies            JSONB NOT NULL DEFAULT '{}'::JSONB,
  tax_id              TEXT,
  -- Our check of their website / listings.
  verified_at         DATE,
  verification_notes  TEXT,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_kinds ON suppliers USING GIN (kinds);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON suppliers FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Excursion / transfer details on products.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_id          UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS net_price            NUMERIC(10,2),   -- what we pay the supplier, before tax
  ADD COLUMN IF NOT EXISTS price_unit           TEXT,            -- 'person' | 'group' | 'boat' | 'vehicle' | 'item'
  ADD COLUMN IF NOT EXISTS price_on_request     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_notes          TEXT,
  ADD COLUMN IF NOT EXISTS min_participants     INT,
  ADD COLUMN IF NOT EXISTS min_age              INT,
  ADD COLUMN IF NOT EXISTS schedule             TEXT,
  ADD COLUMN IF NOT EXISTS season               TEXT,
  ADD COLUMN IF NOT EXISTS includes             TEXT,
  ADD COLUMN IF NOT EXISTS what_to_bring        TEXT,
  ADD COLUMN IF NOT EXISTS meeting_point        TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy  TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes       TEXT;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS net_price        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS min_participants INT,
  ADD COLUMN IF NOT EXISTS max_participants INT;

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);

-- Missing sub-categories for what the suppliers offer.
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-diving',  'Diving',  'Scuba diving and dive courses', 7),
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-fishing', 'Fishing', 'Inshore and deep sea fishing', 8)
ON CONFLICT (slug) DO NOTHING;
