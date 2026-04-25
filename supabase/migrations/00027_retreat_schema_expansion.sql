-- ============================================================
-- 00027: Retreat Schema Expansion
-- Single block — paste into Supabase SQL Editor and run
-- ============================================================

-- ── Enum ──
DO $$ BEGIN
  CREATE TYPE transfer_vehicle_type AS ENUM (
    'shuttle','private_car','taxi','taxi_boat','local_flight',
    'public_bus','bus_company','train','helicopter',
    'private_plane','private_jet','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Retreats table additions ──
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS feature_image_url text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS retreat_type text NOT NULL DEFAULT 'yoga';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS retreat_type_custom text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS skill_level text DEFAULT 'all_levels';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS primary_language text DEFAULT 'en';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS secondary_language text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS highlights jsonb DEFAULT '[]'::jsonb;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_is_included jsonb DEFAULT '[]'::jsonb;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_is_not_included jsonb DEFAULT '[]'::jsonb;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS prerequisites text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_to_bring text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_to_expect text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS faqs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS cancellation_policy text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS itinerary jsonb DEFAULT '[]'::jsonb;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS check_in_time time DEFAULT '15:00';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS check_out_time time DEFAULT '11:00';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS registration_deadline date;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS min_capacity int;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS minimum_age int;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS maximum_age int;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS requires_application boolean DEFAULT false;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS ryt_hours numeric;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS certificate_offered boolean DEFAULT false;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS addons_enabled boolean DEFAULT true;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS nearest_airport text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS is_private_retreat boolean DEFAULT false;
ALTER TABLE retreats ALTER COLUMN deposit_percentage SET DEFAULT 50;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS pricing_model text DEFAULT 'fixed';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS curve_start_price numeric(10,2);
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS curve_end_price numeric(10,2);
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS website_slug text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS structured_data jsonb DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS idx_retreats_website_slug ON retreats(website_slug) WHERE website_slug IS NOT NULL;

-- ── Persons additions ──
ALTER TABLE persons ADD COLUMN IF NOT EXISTS passport_expiry date;

-- ── Guest details additions ──
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS dietary_preferences text[] DEFAULT '{}';

-- ── Booking participants additions ──
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS travel_insurance_provider text;
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS travel_insurance_policy text;
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS travel_insurance_dates text;
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS visa_notes text;

-- ── Bookings additions ──
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_name_in_cohort boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_travel_in_cohort boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_room_in_cohort boolean DEFAULT false;

-- ── Leads additions ──
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign text;

-- ── New role seeds ──
INSERT INTO roles (slug, name, description, category, access_level, sort_order) VALUES
  ('retreat_leader', 'Retreat Leader', 'Primary retreat leader/teacher with portal access', 'education', 3, 50),
  ('retreat_co_teacher', 'Retreat Co-Teacher', 'Co-teacher who shares teaching duties', 'education', 2, 51),
  ('retreat_assistant', 'Retreat Assistant', 'Assists the lead teacher during the retreat', 'education', 2, 52),
  ('retreat_guest_speaker', 'Retreat Guest Speaker', 'Guest presenter for specific sessions', 'education', 2, 53)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- NEW TABLES
-- ══════════════════════════════════════════════════════════════

-- ── 1. Retreat Media ──
CREATE TABLE IF NOT EXISTS retreat_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  url text NOT NULL,
  media_type text NOT NULL DEFAULT 'photo',
  purpose text DEFAULT 'gallery',
  caption text,
  alt_text text,
  sort_order int DEFAULT 0,
  width int,
  height int,
  file_size int,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retreat_media_retreat ON retreat_media(retreat_id);
CREATE INDEX IF NOT EXISTS idx_retreat_media_purpose ON retreat_media(retreat_id, purpose);
ALTER TABLE retreat_media ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_media FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read access" ON retreat_media FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Retreat Teachers ──
CREATE TABLE IF NOT EXISTS retreat_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'lead',
  is_primary boolean DEFAULT false,
  bio_override text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(retreat_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_retreat_teachers_retreat ON retreat_teachers(retreat_id);
CREATE INDEX IF NOT EXISTS idx_retreat_teachers_person ON retreat_teachers(person_id);
ALTER TABLE retreat_teachers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_teachers FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read access" ON retreat_teachers FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Teacher Profiles ──
CREATE TABLE IF NOT EXISTS teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES persons(id) ON DELETE CASCADE,
  short_bio text DEFAULT '',
  public_bio text DEFAULT '',
  teaching_style text DEFAULT '',
  years_experience int,
  certifications jsonb DEFAULT '[]'::jsonb,
  specialties text[] DEFAULT '{}',
  languages text[] DEFAULT '{en}',
  photo_url text,
  banner_image_url text,
  intro_video_url text,
  website_url text,
  social_links jsonb DEFAULT '{}'::jsonb,
  website_slug text UNIQUE,
  meta_description text,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON teacher_profiles FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read active" ON teacher_profiles FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Retreat Pricing Tiers ──
CREATE TABLE IF NOT EXISTS retreat_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  name text NOT NULL,
  tier_order int NOT NULL DEFAULT 0,
  price numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  cutoff_date date,
  spaces_total int,
  spaces_sold int DEFAULT 0,
  lodging_type_id uuid REFERENCES lodging_types(id) ON DELETE SET NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_retreat ON retreat_pricing_tiers(retreat_id);
ALTER TABLE retreat_pricing_tiers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_pricing_tiers FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read active" ON retreat_pricing_tiers FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Retreat Add-Ons ──
CREATE TABLE IF NOT EXISTS retreat_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price numeric(10,2),
  is_required boolean DEFAULT false,
  max_per_booking int DEFAULT 1,
  description_override text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retreat_addons_retreat ON retreat_addons(retreat_id);
ALTER TABLE retreat_addons ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_addons FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read active" ON retreat_addons FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Retreat Forms ──
CREATE TABLE IF NOT EXISTS retreat_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  form_type text NOT NULL,
  is_enabled boolean DEFAULT false,
  title text DEFAULT '',
  description text DEFAULT '',
  created_from_template text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(retreat_id, form_type)
);
CREATE INDEX IF NOT EXISTS idx_retreat_forms_retreat ON retreat_forms(retreat_id);
ALTER TABLE retreat_forms ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_forms FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. Retreat Form Questions ──
CREATE TABLE IF NOT EXISTS retreat_form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES retreat_forms(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_type text NOT NULL DEFAULT 'text',
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean DEFAULT false,
  help_text text,
  placeholder text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_questions_form ON retreat_form_questions(form_id);
ALTER TABLE retreat_form_questions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_form_questions FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. Retreat Form Responses ──
CREATE TABLE IF NOT EXISTS retreat_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES retreat_forms(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  status text DEFAULT 'submitted',
  reviewed_by uuid REFERENCES persons(id),
  reviewed_at timestamptz,
  review_notes text,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_responses_form ON retreat_form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_person ON retreat_form_responses(person_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_booking ON retreat_form_responses(booking_id);
ALTER TABLE retreat_form_responses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_form_responses FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 9. Retreat Form Answers ──
CREATE TABLE IF NOT EXISTS retreat_form_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES retreat_form_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES retreat_form_questions(id) ON DELETE CASCADE,
  answer_text text,
  answer_json jsonb,
  document_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(response_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_form_answers_response ON retreat_form_answers(response_id);
ALTER TABLE retreat_form_answers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_form_answers FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 10. Retreat Waitlist ──
CREATE TABLE IF NOT EXISTS retreat_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  lodging_preference text,
  position int NOT NULL DEFAULT 0,
  status text DEFAULT 'waiting',
  signed_up_at timestamptz DEFAULT now(),
  notified_at timestamptz,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_waitlist_retreat ON retreat_waitlist(retreat_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON retreat_waitlist(retreat_id, status);
ALTER TABLE retreat_waitlist ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_waitlist FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 11. Transfer Bookings ──
CREATE TABLE IF NOT EXISTS transfer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  direction text NOT NULL,
  pickup_location text,
  dropoff_location text,
  pickup_datetime timestamptz,
  vehicle_type transfer_vehicle_type DEFAULT 'shuttle',
  vehicle_type_custom text,
  seats_needed int DEFAULT 1,
  confirmation_code text,
  driver_name text,
  driver_phone text,
  company_name text,
  notes text,
  status text DEFAULT 'pending',
  cost numeric(10,2),
  currency text DEFAULT 'USD',
  is_visible_to_cohort boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfers_booking ON transfer_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_transfers_person ON transfer_bookings(person_id);
ALTER TABLE transfer_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON transfer_bookings FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 12. Retreat Chat Groups ──
CREATE TABLE IF NOT EXISTS retreat_chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  platform text NOT NULL,
  group_name text,
  url text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_groups_retreat ON retreat_chat_groups(retreat_id);
ALTER TABLE retreat_chat_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_chat_groups FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 13. Retreat Reviews ──
CREATE TABLE IF NOT EXISTS retreat_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  overall_rating int NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL,
  would_recommend boolean,
  is_public boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  resort_response text,
  resort_responded_at timestamptz,
  resort_responded_by uuid REFERENCES persons(id),
  leader_response text,
  leader_responded_at timestamptz,
  leader_responded_by uuid REFERENCES persons(id),
  submitted_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES persons(id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_retreat ON retreat_reviews(retreat_id);
CREATE INDEX IF NOT EXISTS idx_reviews_person ON retreat_reviews(person_id);
CREATE INDEX IF NOT EXISTS idx_reviews_featured ON retreat_reviews(is_featured) WHERE is_featured = true;
ALTER TABLE retreat_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_reviews FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read approved public" ON retreat_reviews FOR SELECT USING (is_public = true AND approved_at IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 14. General Testimonials (future use) ──
CREATE TABLE IF NOT EXISTS general_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  person_title text,
  person_photo_url text,
  body text NOT NULL,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL,
  is_featured boolean DEFAULT false,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE general_testimonials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON general_testimonials FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anon read active" ON general_testimonials FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 15. Promo Codes ──
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL,
  discount_value numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  applies_to text DEFAULT 'all',
  retreat_ids jsonb DEFAULT '[]'::jsonb,
  lodging_type_ids jsonb DEFAULT '[]'::jsonb,
  min_booking_amount numeric(10,2),
  max_uses int,
  uses_count int DEFAULT 0,
  is_single_use_per_person boolean DEFAULT false,
  is_stackable boolean DEFAULT false,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES persons(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON promo_codes FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 16. Booking Discounts ──
CREATE TABLE IF NOT EXISTS booking_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  discount_source text NOT NULL,
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  discount_type text NOT NULL,
  discount_value numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  description text,
  applied_by uuid REFERENCES persons(id),
  applied_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_discounts_booking ON booking_discounts(booking_id);
ALTER TABLE booking_discounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON booking_discounts FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 17. Signed Documents ──
CREATE TABLE IF NOT EXISTS signed_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  document_version text,
  document_template_url text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  signature_data text,
  document_url text NOT NULL,
  document_hash text,
  is_public boolean DEFAULT false,
  public_description_key text,
  blockchain_tx_url text,
  bucket_path text,
  is_current boolean DEFAULT true,
  superseded_by uuid REFERENCES signed_documents(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signed_docs_person ON signed_documents(person_id);
CREATE INDEX IF NOT EXISTS idx_signed_docs_booking ON signed_documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_signed_docs_retreat ON signed_documents(retreat_id);
ALTER TABLE signed_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON signed_documents FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 18. Retreat Certificates ──
CREATE TABLE IF NOT EXISTS retreat_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  certificate_type text NOT NULL,
  hours_awarded numeric,
  issued_at timestamptz DEFAULT now(),
  certificate_url text,
  certificate_number text UNIQUE,
  issuing_org text DEFAULT 'Anamaya Resort',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certificates_person ON retreat_certificates(person_id);
CREATE INDEX IF NOT EXISTS idx_certificates_retreat ON retreat_certificates(retreat_id);
ALTER TABLE retreat_certificates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON retreat_certificates FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 19. Communication Log ──
CREATE TABLE IF NOT EXISTS communication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL,
  channel text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  subject text,
  body_preview text,
  body_full text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text DEFAULT 'sent',
  sent_by uuid REFERENCES persons(id),
  template_id text,
  is_manual_entry boolean DEFAULT false,
  call_duration_minutes int,
  external_message_id text,
  source_bot text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comms_person ON communication_log(person_id);
CREATE INDEX IF NOT EXISTS idx_comms_booking ON communication_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_comms_retreat ON communication_log(retreat_id);
CREATE INDEX IF NOT EXISTS idx_comms_channel ON communication_log(channel);
CREATE INDEX IF NOT EXISTS idx_comms_sent_at ON communication_log(sent_at DESC);
ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON communication_log FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 20. Guest Notes ──
CREATE TABLE IF NOT EXISTS guest_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  author_person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  note_type text DEFAULT 'general',
  body text NOT NULL,
  is_flagged boolean DEFAULT false,
  visible_to text DEFAULT 'team',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_notes_guest ON guest_notes(guest_person_id);
CREATE INDEX IF NOT EXISTS idx_guest_notes_retreat ON guest_notes(retreat_id);
CREATE INDEX IF NOT EXISTS idx_guest_notes_author ON guest_notes(author_person_id);
ALTER TABLE guest_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Service role full access" ON guest_notes FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════
-- COHORT VIEW
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW retreat_cohort_view AS
SELECT
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
LEFT JOIN booking_bed_assignments bba ON bba.booking_id = b.id
LEFT JOIN beds bed ON bed.id = bba.bed_id
LEFT JOIN rooms r ON r.id = bed.room_id
WHERE b.status IN ('deposit_paid', 'paid_in_full', 'checked_in');
