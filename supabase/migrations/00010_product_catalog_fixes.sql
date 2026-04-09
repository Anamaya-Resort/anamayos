-- AO Platform: Product catalog fixes
-- Migration 00010

-- Fix variant_id FK on booking_line_items — allow variant deletion
ALTER TABLE booking_line_items
  DROP CONSTRAINT IF EXISTS booking_line_items_variant_id_fkey;
ALTER TABLE booking_line_items
  ADD CONSTRAINT booking_line_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

-- Add missing index on booking_line_items.variant_id
CREATE INDEX IF NOT EXISTS idx_bli_variant
  ON booking_line_items(variant_id) WHERE variant_id IS NOT NULL;

-- Add updated_at to package_items (was missing)
ALTER TABLE package_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER package_items_updated_at BEFORE UPDATE ON package_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Make booking_participants.updated_at NOT NULL
ALTER TABLE booking_participants
  ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE booking_participants
  ALTER COLUMN updated_at SET DEFAULT now();
