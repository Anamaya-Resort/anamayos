-- ============================================================
-- 00028: Retreat Schema Fixes
-- Fixes: missing ON DELETE, cohort view duplicates, missing
-- constraints, missing indexes
-- ============================================================

-- ── 1. Fix reviewer/operator FKs that block person deletion ──
-- These need ON DELETE SET NULL since they're audit trails

ALTER TABLE retreat_form_responses
  DROP CONSTRAINT IF EXISTS retreat_form_responses_reviewed_by_fkey,
  ADD CONSTRAINT retreat_form_responses_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE retreat_reviews
  DROP CONSTRAINT IF EXISTS retreat_reviews_resort_responded_by_fkey,
  ADD CONSTRAINT retreat_reviews_resort_responded_by_fkey
    FOREIGN KEY (resort_responded_by) REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE retreat_reviews
  DROP CONSTRAINT IF EXISTS retreat_reviews_leader_responded_by_fkey,
  ADD CONSTRAINT retreat_reviews_leader_responded_by_fkey
    FOREIGN KEY (leader_responded_by) REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE retreat_reviews
  DROP CONSTRAINT IF EXISTS retreat_reviews_approved_by_fkey,
  ADD CONSTRAINT retreat_reviews_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE promo_codes
  DROP CONSTRAINT IF EXISTS promo_codes_created_by_fkey,
  ADD CONSTRAINT promo_codes_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE booking_discounts
  DROP CONSTRAINT IF EXISTS booking_discounts_applied_by_fkey,
  ADD CONSTRAINT booking_discounts_applied_by_fkey
    FOREIGN KEY (applied_by) REFERENCES persons(id) ON DELETE SET NULL;

ALTER TABLE communication_log
  DROP CONSTRAINT IF EXISTS communication_log_sent_by_fkey,
  ADD CONSTRAINT communication_log_sent_by_fkey
    FOREIGN KEY (sent_by) REFERENCES persons(id) ON DELETE SET NULL;

-- ── 2. Fix cohort view — filter to confirmed beds + deduplicate ──

CREATE OR REPLACE VIEW retreat_cohort_view AS
SELECT DISTINCT ON (b.id)
  b.retreat_id,
  b.id AS booking_id,
  b.person_id,
  CASE WHEN b.share_name_in_cohort THEN p.full_name ELSE 'Guest' END AS display_name,
  CASE WHEN b.share_name_in_cohort THEN p.avatar_url ELSE NULL END AS avatar_url,
  CASE WHEN b.share_travel_in_cohort THEN bp.arrival_date ELSE NULL END AS arrival_date,
  CASE WHEN b.share_travel_in_cohort THEN bp.arrival_time ELSE NULL END AS arrival_time,
  CASE WHEN b.share_travel_in_cohort THEN bp.arrival_flight ELSE NULL END AS arrival_flight,
  CASE WHEN b.share_travel_in_cohort THEN bp.departure_date ELSE NULL END AS departure_date,
  CASE WHEN b.share_travel_in_cohort THEN bp.departure_time ELSE NULL END AS departure_time,
  CASE WHEN b.share_travel_in_cohort THEN bp.departure_flight ELSE NULL END AS departure_flight,
  CASE WHEN b.share_room_in_cohort THEN r.name ELSE NULL END AS room_name,
  b.status AS booking_status
FROM bookings b
JOIN persons p ON p.id = b.person_id
LEFT JOIN booking_participants bp ON bp.booking_id = b.id AND bp.is_primary = true
LEFT JOIN booking_bed_assignments bba ON bba.booking_id = b.id AND bba.status = 'confirmed'
LEFT JOIN beds bed ON bed.id = bba.bed_id
LEFT JOIN rooms r ON r.id = bed.room_id
WHERE b.status IN ('deposit_paid', 'paid_in_full', 'checked_in')
ORDER BY b.id;

-- ── 3. Validation constraints ──

-- Custom retreat type must have a custom name
ALTER TABLE retreats DROP CONSTRAINT IF EXISTS custom_retreat_requires_custom_type;
ALTER TABLE retreats ADD CONSTRAINT custom_retreat_requires_custom_type
  CHECK (retreat_type != 'custom' OR retreat_type_custom IS NOT NULL);

-- Bonding curve pricing needs start price, end price, and max capacity
ALTER TABLE retreats DROP CONSTRAINT IF EXISTS bonding_curve_needs_prices;
ALTER TABLE retreats ADD CONSTRAINT bonding_curve_needs_prices
  CHECK (pricing_model != 'dynamic_plus' OR (curve_start_price IS NOT NULL AND curve_end_price IS NOT NULL));

ALTER TABLE retreats DROP CONSTRAINT IF EXISTS bonding_curve_needs_capacity;
ALTER TABLE retreats ADD CONSTRAINT bonding_curve_needs_capacity
  CHECK (pricing_model != 'dynamic_plus' OR max_capacity IS NOT NULL);

-- ── 4. Missing indexes on reviewer/operator FKs ──

CREATE INDEX IF NOT EXISTS idx_form_responses_reviewed ON retreat_form_responses(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_reviews_approved_by ON retreat_reviews(approved_by);
CREATE INDEX IF NOT EXISTS idx_reviews_resort_responded_by ON retreat_reviews(resort_responded_by);
CREATE INDEX IF NOT EXISTS idx_reviews_leader_responded_by ON retreat_reviews(leader_responded_by);
CREATE INDEX IF NOT EXISTS idx_promo_created_by ON promo_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_discounts_applied_by ON booking_discounts(applied_by);
CREATE INDEX IF NOT EXISTS idx_comms_sent_by ON communication_log(sent_by);
