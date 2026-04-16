-- ============================================================
-- Migration 00013: Bed-Level Booking & Assignment System
-- Per-bed availability, shared-bed approval, accommodation rules
-- ============================================================

-- ============================================================
-- 1. UPDATE BED TYPE ENUM
-- ============================================================

-- Add single_long to existing bed_type enum
ALTER TYPE bed_type ADD VALUE IF NOT EXISTS 'single_long' AFTER 'single';

-- ============================================================
-- 2. ENHANCE BEDS TABLE
-- ============================================================

-- Physical dimensions and capacity metadata
ALTER TABLE beds ADD COLUMN IF NOT EXISTS width_m NUMERIC(3,2);
ALTER TABLE beds ADD COLUMN IF NOT EXISTS length_m NUMERIC(3,2);
ALTER TABLE beds ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 1;

-- Backfill dimensions and capacity from bed_type for existing rows
-- Note: single_long is skipped here — it's a new enum value and can't be referenced
-- in the same transaction it was added. No existing rows have this type.
UPDATE beds SET width_m = 1.00, length_m = 1.90, capacity = 1 WHERE bed_type = 'single';
UPDATE beds SET width_m = 1.35, length_m = 2.00, capacity = 2 WHERE bed_type = 'double';
UPDATE beds SET width_m = 1.52, length_m = 2.00, capacity = 2 WHERE bed_type = 'queen';
UPDATE beds SET width_m = 2.00, length_m = 2.00, capacity = 2 WHERE bed_type = 'king';
UPDATE beds SET width_m = 1.00, length_m = 1.90, capacity = 1 WHERE bed_type = 'bunk_top';
UPDATE beds SET width_m = 1.00, length_m = 1.90, capacity = 1 WHERE bed_type = 'bunk_bottom';

-- Ensure capacity stays sane
ALTER TABLE beds ADD CONSTRAINT beds_capacity_check CHECK (capacity >= 1 AND capacity <= 4);

-- ============================================================
-- 3. ENHANCE BED CONFIGURATIONS (retreat-level overrides)
-- ============================================================

-- Link configurations to a specific retreat (null = general date override)
ALTER TABLE bed_configurations ADD COLUMN IF NOT EXISTS retreat_id UUID REFERENCES retreats(id) ON DELETE CASCADE;

-- Allow adding temporary beds to a room for a retreat
ALTER TABLE bed_configurations ADD COLUMN IF NOT EXISTS override_capacity INT;
ALTER TABLE bed_configurations ADD COLUMN IF NOT EXISTS override_label TEXT;

CREATE INDEX IF NOT EXISTS idx_bed_configs_retreat ON bed_configurations(retreat_id);

-- ============================================================
-- 4. BOOKING BED ASSIGNMENTS
-- ============================================================

CREATE TYPE bed_assignment_status AS ENUM ('confirmed', 'pending_approval', 'declined');

CREATE TABLE booking_bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  status bed_assignment_status NOT NULL DEFAULT 'confirmed',
  assigned_by UUID REFERENCES persons(id),
  approved_by UUID REFERENCES persons(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_booking_bed UNIQUE (booking_id, bed_id)
);

CREATE INDEX idx_bed_assignments_booking ON booking_bed_assignments(booking_id);
CREATE INDEX idx_bed_assignments_bed ON booking_bed_assignments(bed_id);
CREATE INDEX idx_bed_assignments_status ON booking_bed_assignments(status);

CREATE TRIGGER trg_bed_assignments_updated_at
  BEFORE UPDATE ON booking_bed_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. ACCOMMODATION RULES (conditions & warnings)
-- ============================================================

-- Future-ready schema for bed/room conditions that guests must acknowledge.
-- Examples: "loft bed requires climbing ladder", "shared bathroom", "no AC"
-- Rules are evaluated during bed selection in the booking flow.

CREATE TYPE accommodation_rule_type AS ENUM ('acknowledgment', 'warning', 'restriction');

CREATE TABLE accommodation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('room', 'bed')),
  entity_id UUID NOT NULL,
  rule_type accommodation_rule_type NOT NULL DEFAULT 'acknowledgment',
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accomm_rules_entity ON accommodation_rules(entity_type, entity_id);
CREATE INDEX idx_accomm_rules_active ON accommodation_rules(is_active);

CREATE TRIGGER trg_accomm_rules_updated_at
  BEFORE UPDATE ON accommodation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

ALTER TABLE booking_bed_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_rules ENABLE ROW LEVEL SECURITY;

-- Bed assignments: guest sees own, staff+ sees all, staff+ writes
CREATE POLICY bed_assignments_select_own ON booking_bed_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_bed_assignments.booking_id
        AND b.person_id = (SELECT id FROM persons WHERE auth_user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY bed_assignments_select_staff ON booking_bed_assignments
  FOR SELECT TO authenticated
  USING (current_user_access_level() >= 3);

CREATE POLICY bed_assignments_staff_write ON booking_bed_assignments
  FOR ALL TO authenticated
  USING (current_user_access_level() >= 3)
  WITH CHECK (current_user_access_level() >= 3);

-- Accommodation rules: any authenticated reads, admin+ writes
CREATE POLICY accomm_rules_select ON accommodation_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY accomm_rules_admin ON accommodation_rules
  FOR ALL TO authenticated
  USING (current_user_access_level() >= 5)
  WITH CHECK (current_user_access_level() >= 5);
