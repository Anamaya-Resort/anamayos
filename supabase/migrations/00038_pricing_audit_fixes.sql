-- ============================================================
-- 00038: Pricing audit fixes
--
-- Cleans up issues found auditing migrations 27, 34, 35:
--   1. retreats.pricing_model — add CHECK allowlist
--   2. retreats.pricing_options — mark deprecated via COMMENT
--   3. retreats.deposit_percentage — backfill 60 → 50 (default
--      changed in 0027 but RG-imported rows still hold 60)
--   4. retreat_workshop_bookings — drop broken RLS policy that
--      references auth.uid() (we use LightningWorks SSO; auth.uid
--      is always null, so the policy returns no rows ever)
--   5. retreat_workshop_bookings — replace UNIQUE
--      (workshop_id, booking_id) with (workshop_id, booking_id,
--      person_id) to allow multi-guest bookings to register
--      separate participants for the same workshop
--   6. retreat_workshop_bookings.transaction_id — missing index
--   7. retreat_workshops — add per-pct upper-bound check (0–100)
--   8. retreat_addons.max_per_booking — change default 1 → NULL
--      (1 is too restrictive for transfers, meals, etc.)
-- ============================================================

-- ── 1. retreats.pricing_model CHECK ──
ALTER TABLE retreats
  DROP CONSTRAINT IF EXISTS retreats_pricing_model_check;
ALTER TABLE retreats
  ADD CONSTRAINT retreats_pricing_model_check
  CHECK (pricing_model IS NULL OR pricing_model IN ('fixed', 'tiered', 'bonding_curve'));

-- ── 2. retreats.pricing_options deprecation ──
COMMENT ON COLUMN retreats.pricing_options IS
  'DEPRECATED — legacy RG payload. Use pricing_model + retreat_pricing_tiers instead. Will be dropped after importer is updated to stop writing this column.';

-- ── 3. Backfill deposit_percentage 60 → 50 ──
UPDATE retreats SET deposit_percentage = 50 WHERE deposit_percentage = 60;

-- ── 4. Drop broken RLS policy ──
DROP POLICY IF EXISTS "Guests see own workshop bookings" ON retreat_workshop_bookings;

-- ── 5. Replace UNIQUE (workshop_id, booking_id) → +person_id ──
ALTER TABLE retreat_workshop_bookings
  DROP CONSTRAINT IF EXISTS retreat_workshop_bookings_workshop_id_booking_id_key;
ALTER TABLE retreat_workshop_bookings
  ADD CONSTRAINT retreat_workshop_bookings_workshop_booking_person_key
  UNIQUE (workshop_id, booking_id, person_id);

-- ── 6. Index on transaction_id ──
CREATE INDEX IF NOT EXISTS idx_retreat_workshop_bookings_transaction_id
  ON retreat_workshop_bookings(transaction_id);

-- ── 7. Workshop pct upper-bound check ──
ALTER TABLE retreat_workshops
  DROP CONSTRAINT IF EXISTS pct_within_bounds;
ALTER TABLE retreat_workshops
  ADD CONSTRAINT pct_within_bounds
  CHECK (
    sales_commission_pct BETWEEN 0 AND 100
    AND anamaya_pct BETWEEN 0 AND 100
    AND retreat_leader_pct BETWEEN 0 AND 100
  );

-- ── 8. retreat_addons.max_per_booking default ──
ALTER TABLE retreat_addons
  ALTER COLUMN max_per_booking DROP DEFAULT;
COMMENT ON COLUMN retreat_addons.max_per_booking IS
  'NULL = unlimited. Use small values only for genuinely scarce add-ons (e.g. private rooms).';
