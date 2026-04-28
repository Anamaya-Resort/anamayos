-- ============================================================
-- 00035: Sales commission on retreat workshops
--
-- Adds a `sales_commission_pct` column to retreat_workshops so booking
-- staff/receptionists who close a workshop sale earn a cut. Defaults
-- to 0% (no commission) — retreat leaders can opt to raise it (giving
-- up part of their share) to incentivize the front desk to push the
-- workshop on calls and walk-ins.
--
-- The three percentages (commission + house + leader) must still sum
-- to 100; the seller's commission comes off the top of the gross sale.
-- ============================================================

ALTER TABLE retreat_workshops
  ADD COLUMN IF NOT EXISTS sales_commission_pct numeric(5,2) NOT NULL DEFAULT 0.00;

ALTER TABLE retreat_workshops DROP CONSTRAINT IF EXISTS split_sums_to_100;
ALTER TABLE retreat_workshops DROP CONSTRAINT IF EXISTS pct_non_negative;

ALTER TABLE retreat_workshops
  ADD CONSTRAINT split_sums_to_100
  CHECK (sales_commission_pct + anamaya_pct + retreat_leader_pct = 100.00);

ALTER TABLE retreat_workshops
  ADD CONSTRAINT pct_non_negative
  CHECK (sales_commission_pct >= 0 AND anamaya_pct >= 0 AND retreat_leader_pct >= 0);

COMMENT ON COLUMN retreat_workshops.sales_commission_pct IS
  'Percent of gross sale paid to the booking-staff/receptionist who closed the sale. Defaults 0; retreat leader can raise to incentivize selling. Sum with anamaya_pct + retreat_leader_pct must equal 100.';
