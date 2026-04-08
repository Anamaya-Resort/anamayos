-- AO Platform: Retreats, transactions, room blocks, and Retreat Guru import support
-- Migration 00006

-- ============================================================
-- RETREAT GURU ID COLUMNS (for dedup and re-sync)
-- ============================================================

ALTER TABLE persons ADD COLUMN IF NOT EXISTS rg_id INT UNIQUE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rg_id INT UNIQUE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rg_id INT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_persons_rg_id ON persons(rg_id) WHERE rg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_rg_id ON rooms(rg_id) WHERE rg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_rg_id ON leads(rg_id) WHERE rg_id IS NOT NULL;

-- ============================================================
-- RETREATS (maps from RG programs)
-- ============================================================

CREATE TYPE retreat_status AS ENUM ('draft', 'confirmed', 'cancelled', 'completed');
CREATE TYPE retreat_pricing_type AS ENUM ('tiered', 'lodging');
CREATE TYPE retreat_date_type AS ENUM ('fixed', 'package', 'hotel', 'dateless');

CREATE TABLE retreats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rg_id INT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  excerpt TEXT,
  date_type retreat_date_type NOT NULL DEFAULT 'fixed',
  start_date DATE,
  end_date DATE,
  package_nights INT,
  status retreat_status NOT NULL DEFAULT 'draft',
  is_public BOOLEAN NOT NULL DEFAULT true,
  registration_status TEXT DEFAULT 'open',
  leader_person_id UUID REFERENCES persons(id),
  categories TEXT[] DEFAULT '{}',
  pricing_type retreat_pricing_type NOT NULL DEFAULT 'lodging',
  pricing_options JSONB DEFAULT '{}'::JSONB,
  deposit_percentage INT DEFAULT 60,
  max_capacity INT,
  available_spaces INT,
  currency TEXT NOT NULL DEFAULT 'USD',
  waitlist_enabled BOOLEAN NOT NULL DEFAULT false,
  program_info JSONB DEFAULT '{}'::JSONB,
  images JSONB DEFAULT '[]'::JSONB,
  external_link TEXT,
  registration_link TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retreats_dates ON retreats(start_date, end_date);
CREATE INDEX idx_retreats_status ON retreats(status);
CREATE INDEX idx_retreats_leader ON retreats(leader_person_id);
CREATE INDEX idx_retreats_rg_id ON retreats(rg_id) WHERE rg_id IS NOT NULL;

CREATE TRIGGER retreats_updated_at BEFORE UPDATE ON retreats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RETREAT ROOM BLOCKS (which rooms are allocated to which retreat)
-- ============================================================

CREATE TYPE room_block_type AS ENUM ('simple', 'restricted', 'whitelist');

CREATE TABLE retreat_room_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rg_id INT UNIQUE,
  retreat_id UUID REFERENCES retreats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  block_type room_block_type NOT NULL DEFAULT 'simple',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT block_dates CHECK (end_date >= start_date)
);

CREATE TABLE retreat_room_block_rooms (
  block_id UUID NOT NULL REFERENCES retreat_room_blocks(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (block_id, room_id)
);

CREATE INDEX idx_room_blocks_retreat ON retreat_room_blocks(retreat_id);
CREATE INDEX idx_room_blocks_dates ON retreat_room_blocks(start_date, end_date);
CREATE INDEX idx_room_block_rooms_room ON retreat_room_block_rooms(room_id);

-- ============================================================
-- LODGING TYPES (RG lodgings — pricing tiers per room type)
-- ============================================================

CREATE TABLE lodging_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rg_id INT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  occupancy_type TEXT,
  max_occupancy INT,
  base_price NUMERIC(10,2),
  room_id UUID REFERENCES rooms(id),
  images JSONB DEFAULT '[]'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lodging_types_rg_id ON lodging_types(rg_id) WHERE rg_id IS NOT NULL;
CREATE INDEX idx_lodging_types_room ON lodging_types(room_id);

-- ============================================================
-- ENHANCE BOOKINGS (add retreat link, RG IDs, room/lodging)
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rg_id INT UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS retreat_id UUID REFERENCES retreats(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lodging_type_id UUID REFERENCES lodging_types(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_type TEXT DEFAULT 'participant';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rg_parent_booking_id INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parent_booking_id UUID REFERENCES bookings(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_bookings_rg_id ON bookings(rg_id) WHERE rg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_retreat ON bookings(retreat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);

-- ============================================================
-- TRANSACTIONS (financial records)
-- ============================================================

CREATE TYPE transaction_class AS ENUM (
  'item', 'card_payment', 'non_cc_payment', 'discount', 'card_refund'
);
CREATE TYPE transaction_category AS ENUM (
  'lodging', 'payment', 'other_payment', 'discount', 'program_addon',
  'program', 'retreat_package', 'cash_payment', 'other_charge', 'refund'
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rg_id INT UNIQUE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trans_date TIMESTAMPTZ,
  class transaction_class NOT NULL,
  category transaction_category NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete',
  description TEXT,
  person_id UUID REFERENCES persons(id),
  booking_id UUID REFERENCES bookings(id),
  retreat_id UUID REFERENCES retreats(id),
  charge_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_1_info TEXT,
  tax_1_amount NUMERIC(12,2) DEFAULT 0,
  tax_2_info TEXT,
  tax_2_amount NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  grand_total NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  quantity INT DEFAULT 1,
  price_per_item NUMERIC(12,2),
  is_addon BOOLEAN DEFAULT false,
  fund_method TEXT,
  merchant_name TEXT,
  merchant_trans_id TEXT,
  revenue JSONB DEFAULT '{}'::JSONB,
  notes TEXT,
  gl_code TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_person ON transactions(person_id);
CREATE INDEX idx_transactions_booking ON transactions(booking_id);
CREATE INDEX idx_transactions_retreat ON transactions(retreat_id);
CREATE INDEX idx_transactions_class ON transactions(class);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_submitted ON transactions(submitted_at);
CREATE INDEX idx_transactions_rg_id ON transactions(rg_id) WHERE rg_id IS NOT NULL;

CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE retreats ENABLE ROW LEVEL SECURITY;
ALTER TABLE retreat_room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE retreat_room_block_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lodging_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Retreats: any authenticated reads, staff+ writes
CREATE POLICY retreats_select ON retreats FOR SELECT TO authenticated USING (true);
CREATE POLICY retreats_admin ON retreats FOR ALL USING (current_user_access_level() >= 3);

-- Room blocks: any authenticated reads, staff+ writes
CREATE POLICY room_blocks_select ON retreat_room_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY room_blocks_admin ON retreat_room_blocks FOR ALL USING (current_user_access_level() >= 3);
CREATE POLICY room_block_rooms_select ON retreat_room_block_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY room_block_rooms_admin ON retreat_room_block_rooms FOR ALL USING (current_user_access_level() >= 3);

-- Lodging types: any authenticated reads, admin+ writes
CREATE POLICY lodging_types_select ON lodging_types FOR SELECT TO authenticated USING (true);
CREATE POLICY lodging_types_admin ON lodging_types FOR ALL USING (current_user_access_level() >= 5);

-- Transactions: staff+ reads, admin+ writes, guests see own
CREATE POLICY transactions_select ON transactions FOR SELECT USING (
  person_id IN (SELECT id FROM persons WHERE auth_user_id = auth.uid())
  OR current_user_access_level() >= 3
);
CREATE POLICY transactions_admin ON transactions FOR ALL USING (current_user_access_level() >= 5);
