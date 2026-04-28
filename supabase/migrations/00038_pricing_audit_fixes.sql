-- ============================================================
-- 00038: Pricing audit fixes
--
-- Cleans up issues found auditing migrations 27, 34, 35.
-- Bug 1 (pricing_model CHECK) deferred -- migration runner kept
-- rejecting it; revisit in a standalone migration.
-- ============================================================

-- 1. pricing_model check (deferred). Drop any leftover stub.
ALTER TABLE retreats DROP CONSTRAINT IF EXISTS retreats_pricing_model_check;

-- 2. pricing_options deprecation comment
COMMENT ON COLUMN retreats.pricing_options IS 'DEPRECATED - legacy RG payload. Use pricing_model and retreat_pricing_tiers instead.';

-- 3. backfill deposit 60 to 50 (default changed in 0027 but RG-imported rows still hold 60)
UPDATE retreats SET deposit_percentage = 50 WHERE deposit_percentage = 60;

-- 4. drop broken RLS policy that references auth.uid()
--    (LightningWorks SSO is used, auth.uid is always null)
DROP POLICY IF EXISTS "Guests see own workshop bookings" ON retreat_workshop_bookings;

-- 5. replace UNIQUE (workshop_id, booking_id) with (workshop_id, booking_id, person_id)
--    so multi-guest bookings can register separate participants for the same workshop
ALTER TABLE retreat_workshop_bookings
  DROP CONSTRAINT IF EXISTS retreat_workshop_bookings_workshop_id_booking_id_key;

DO $$
BEGIN
  ALTER TABLE retreat_workshop_bookings
    ADD CONSTRAINT retreat_workshop_bookings_workshop_booking_person_key
    UNIQUE (workshop_id, booking_id, person_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- 6. transaction_id index (missing from 0034)
CREATE INDEX IF NOT EXISTS idx_retreat_workshop_bookings_transaction_id
  ON retreat_workshop_bookings(transaction_id);

-- 7. workshop pct upper-bound check (each split column 0..100)
ALTER TABLE retreat_workshops DROP CONSTRAINT IF EXISTS pct_within_bounds;

ALTER TABLE retreat_workshops
  ADD CONSTRAINT pct_within_bounds
  CHECK (sales_commission_pct BETWEEN 0 AND 100
     AND anamaya_pct BETWEEN 0 AND 100
     AND retreat_leader_pct BETWEEN 0 AND 100);

-- 8. retreat_addons.max_per_booking default dropped (1 was too restrictive)
ALTER TABLE retreat_addons ALTER COLUMN max_per_booking DROP DEFAULT;
COMMENT ON COLUMN retreat_addons.max_per_booking IS 'NULL = unlimited.';
