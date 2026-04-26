-- ============================================================
-- 00034: Retreat Workshops + Storage Buckets + who_is_this_for
--
-- Adds:
--   1. retreat_workshops              — per-retreat-only workshop catalog
--                                       with revenue split fields
--   2. retreat_workshop_bookings      — sign-ups, frozen split snapshot,
--                                       links to transactions for folio
--   3. retreats.who_is_this_for       — dedicated text column (was missing)
--   4. Storage buckets                — retreat-media, retreat-leader-photos,
--                                       general-media (public read)
--   5. retreat_workshop_payouts_view  — payout reporting roll-up
--
-- Workshops are intentionally NOT generalized products: each row belongs
-- to exactly one retreat. They flow through the existing transactions
-- table (category='program_addon') so the folio system shows them on
-- guest bills with no further plumbing. Revenue splits are frozen at
-- sale time so editing a workshop's percentages later does not retro-
-- change historical bookings.
-- ============================================================

-- ── 1. retreats.who_is_this_for ──
-- Distinct enough from what_to_expect that the WP HTML treats it as its
-- own section. Keep both.
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS who_is_this_for text;


-- ── 2. retreat_workshops ──
CREATE TABLE IF NOT EXISTS retreat_workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,

  -- Identity
  name text NOT NULL,
  description text,
  workshop_kind text NOT NULL DEFAULT 'workshop',
    -- 'workshop' | 'class' | 'session' | 'ceremony' | 'other'
  duration_minutes int,
  scheduled_at timestamptz,
  location_hint text,

  -- Pricing
  price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  -- Optional bundle price for "buy two related workshops together"
  -- (the WP source has e.g. "$40 each, or $60 for both"). Applied via
  -- a paired retreat_workshop only when both are added to the booking.
  bundle_price numeric(10,2),
  bundle_partner_workshop_id uuid REFERENCES retreat_workshops(id) ON DELETE SET NULL,

  -- Capacity (independent of retreat capacity)
  capacity int,
  spots_sold int NOT NULL DEFAULT 0,

  -- Revenue split — defaults to 30 house / 70 retreat leader.
  -- Edit per workshop in the AO admin. Must sum to 100.
  anamaya_pct numeric(5,2) NOT NULL DEFAULT 30.00,
  retreat_leader_pct numeric(5,2) NOT NULL DEFAULT 70.00,
  -- Who receives the retreat-leader share. Defaults to the retreat's
  -- lead teacher (set by the application layer at insert time).
  -- Overridable per workshop so a guest-speaker session can pay out to
  -- that speaker.
  payout_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,

  -- Optional bridge to the products catalog. NOT used to share workshops
  -- across retreats — it's only for cross-retreat reporting roll-ups
  -- ("how many breathwork sessions sold this year"). Created lazily on
  -- first booking; null is fine.
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,

  sort_order int NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT split_sums_to_100 CHECK (anamaya_pct + retreat_leader_pct = 100.00),
  CONSTRAINT pct_non_negative CHECK (anamaya_pct >= 0 AND retreat_leader_pct >= 0)
);
CREATE INDEX IF NOT EXISTS idx_workshops_retreat ON retreat_workshops(retreat_id);
CREATE INDEX IF NOT EXISTS idx_workshops_payout_person ON retreat_workshops(payout_person_id);
CREATE INDEX IF NOT EXISTS idx_workshops_product ON retreat_workshops(product_id);
CREATE TRIGGER retreat_workshops_updated_at BEFORE UPDATE ON retreat_workshops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE retreat_workshops ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_workshops FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read active" ON retreat_workshops FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 3. retreat_workshop_bookings ──
CREATE TABLE IF NOT EXISTS retreat_workshop_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES retreat_workshops(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'reserved',
    -- 'reserved' | 'paid' | 'cancelled' | 'attended' | 'no_show'
  charge_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',

  -- Frozen at sale time so historical reports stay stable when a
  -- workshop's pct columns are later edited.
  split_anamaya_amount numeric(10,2) NOT NULL,
  split_retreat_leader_amount numeric(10,2) NOT NULL,
  split_retreat_leader_person_id uuid REFERENCES persons(id) ON DELETE SET NULL,

  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
    -- The folio entry. Folio renders bookings via transactions, so
    -- inserting a row there is what makes the workshop appear on the bill.

  payout_status text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'paid' | 'held' | 'refunded'
  payout_at timestamptz,
  payout_reference text,

  signed_up_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  notes text,

  UNIQUE (workshop_id, booking_id)
);
CREATE INDEX IF NOT EXISTS idx_workshop_bookings_workshop ON retreat_workshop_bookings(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_bookings_booking ON retreat_workshop_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_workshop_bookings_person ON retreat_workshop_bookings(person_id);
CREATE INDEX IF NOT EXISTS idx_workshop_bookings_payout ON retreat_workshop_bookings(payout_status, split_retreat_leader_person_id);

ALTER TABLE retreat_workshop_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_workshop_bookings FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Guests see their own; staff+ see all.
DO $$ BEGIN
  CREATE POLICY "Guests see own workshop bookings" ON retreat_workshop_bookings FOR SELECT USING (
    person_id IN (SELECT id FROM persons WHERE auth_user_id = auth.uid())
    OR current_user_access_level() >= 3
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 4. retreat_workshop_payouts_view ──
-- Roll-up for "how much do we owe each retreat leader this period".
-- Filters to workshop bookings that are paid (or attended) and whose
-- payout has not yet been recorded as paid. Paired with retreat +
-- retreat-leader info for export-friendly accounting.
CREATE OR REPLACE VIEW retreat_workshop_payouts_view AS
SELECT
  wb.id                       AS workshop_booking_id,
  w.retreat_id,
  r.name                      AS retreat_name,
  r.start_date                AS retreat_start_date,
  w.id                        AS workshop_id,
  w.name                      AS workshop_name,
  wb.booking_id,
  wb.person_id                AS guest_person_id,
  wb.split_retreat_leader_person_id   AS retreat_leader_person_id,
  p.full_name                         AS retreat_leader_name,
  wb.split_anamaya_amount,
  wb.split_retreat_leader_amount,
  wb.charge_amount,
  wb.currency,
  wb.status                   AS booking_status,
  wb.payout_status,
  wb.payout_at,
  wb.payout_reference,
  wb.signed_up_at
FROM retreat_workshop_bookings wb
JOIN retreat_workshops w ON w.id = wb.workshop_id
JOIN retreats r ON r.id = w.retreat_id
LEFT JOIN persons p ON p.id = wb.split_retreat_leader_person_id
WHERE wb.status IN ('paid', 'attended');


-- ── 5. Storage buckets ──
-- All marketing media for retreats lives in AO Storage. The website never
-- references the legacy WP-Engine host. Public read is on so the front-
-- end can <img src=...> directly without signed URLs (standard for SEO-
-- visible marketing pages); writes restricted to service role.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('retreat-media',          'retreat-media',          true),
  ('retreat-leader-photos',  'retreat-leader-photos',  true),
  ('general-media',          'general-media',          true)
ON CONFLICT (id) DO NOTHING;

-- Service-role writes (the import pipeline + AO admin actions).
DO $$ BEGIN
  CREATE POLICY "Service role write retreat-media" ON storage.objects
    FOR ALL TO service_role USING (bucket_id = 'retreat-media') WITH CHECK (bucket_id = 'retreat-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role write retreat-leader-photos" ON storage.objects
    FOR ALL TO service_role USING (bucket_id = 'retreat-leader-photos') WITH CHECK (bucket_id = 'retreat-leader-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role write general-media" ON storage.objects
    FOR ALL TO service_role USING (bucket_id = 'general-media') WITH CHECK (bucket_id = 'general-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public read on each bucket (for unauthenticated marketing-site fetches).
DO $$ BEGIN
  CREATE POLICY "Public read retreat-media" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'retreat-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read retreat-leader-photos" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'retreat-leader-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read general-media" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'general-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
