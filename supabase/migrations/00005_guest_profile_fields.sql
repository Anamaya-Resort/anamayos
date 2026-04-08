-- AO Platform: Expanded person and guest profile fields
-- Migration 00005

-- ============================================================
-- EXPAND PERSONS TABLE
-- ============================================================

ALTER TABLE persons ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS passport_number TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS communication_preference TEXT DEFAULT 'email';

-- ============================================================
-- EXPAND GUEST_DETAILS TABLE
-- ============================================================

-- Health & Wellness
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS medications TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS injuries_limitations TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS is_pregnant BOOLEAN DEFAULT false;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS fitness_level TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS yoga_experience TEXT;

-- Retreat preferences
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS room_preference TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS retreat_interests TEXT[];
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS how_heard_about_us TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS referral_person_id UUID REFERENCES persons(id);

-- Legal & Consent
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS waiver_signed BOOLEAN DEFAULT false;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS waiver_signed_at TIMESTAMPTZ;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS waiver_document_url TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS photo_release BOOLEAN DEFAULT false;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Emergency contact expansion
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS emergency_contact_email TEXT;
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- ============================================================
-- PERSON RELATIONSHIPS (spouse, partner, child, friend, etc.)
-- ============================================================

CREATE TABLE person_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  related_person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_relationship CHECK (person_id != related_person_id),
  CONSTRAINT unique_relationship UNIQUE (person_id, related_person_id, relationship_type)
);

CREATE INDEX idx_person_rel_person ON person_relationships(person_id);
CREATE INDEX idx_person_rel_related ON person_relationships(related_person_id);

-- RLS
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_rel_select ON person_relationships FOR SELECT USING (
  person_id IN (SELECT id FROM persons WHERE auth_user_id = auth.uid())
  OR related_person_id IN (SELECT id FROM persons WHERE auth_user_id = auth.uid())
  OR current_user_access_level() >= 3
);
CREATE POLICY person_rel_admin ON person_relationships FOR ALL USING (current_user_access_level() >= 5);

-- Indexes on new person columns
CREATE INDEX idx_persons_country ON persons(country);
CREATE INDEX idx_persons_dob ON persons(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_guest_details_person_role ON guest_details(person_role_id);
