# Retreat & Booking Schema Plan
*AnamayOS + Anamaya-Website, 2026-04-25*

This is the complete schema plan incorporating all 65 audit items plus the user's detailed modifications and new requirements. This covers database tables, columns, enums, RLS policies, and seed/template data. No UI/UX or frontend work is included here — see the companion document `retreat-ui-ux-notes.md` for those.

---

## Table of Contents

1. [Retreats — Core Table Additions](#1-retreats--core-table-additions)
2. [Retreat Types Enum](#2-retreat-types-enum)
3. [Retreat Media](#3-retreat-media)
4. [People Integration — Retreat Leader Roles](#4-people-integration--retreat-leader-roles)
5. [Retreat Teachers Junction](#5-retreat-teachers-junction)
6. [Teacher Profiles (Public)](#6-teacher-profiles-public)
7. [Retreat Website & SEO Fields](#7-retreat-website--seo-fields)
8. [Pricing: Tiers, Dynamic, & Bonding Curve](#8-pricing-tiers-dynamic--bonding-curve)
9. [Deposits](#9-deposits)
10. [Retreat Add-Ons](#10-retreat-add-ons)
11. [Applications & Intake Forms](#11-applications--intake-forms)
12. [Waitlist](#12-waitlist)
13. [Guest Cohort Visibility](#13-guest-cohort-visibility)
14. [Travel & Transfers](#14-travel--transfers)
15. [Travel Chat Groups](#15-travel-chat-groups)
16. [Reviews & Testimonials](#16-reviews--testimonials)
17. [Promo Codes & Discounts](#17-promo-codes--discounts)
18. [Documents & Waivers](#18-documents--waivers)
19. [Certificates](#19-certificates)
20. [Communication Log](#20-communication-log)
21. [Guest Notes (Private)](#21-guest-notes-private)
22. [Persons Table Additions](#22-persons-table-additions)
23. [Guest Details Additions](#23-guest-details-additions)
24. [Bookings Table Additions](#24-bookings-table-additions)
25. [RLS & Access Control Rules](#25-rls--access-control-rules)

---

## 1. Retreats — Core Table Additions

New columns on the existing `retreats` table:

```sql
-- Marketing / public-facing
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS feature_image_url text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS retreat_type text NOT NULL DEFAULT 'yoga';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS retreat_type_custom text; -- if retreat_type = 'custom'
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS skill_level text DEFAULT 'all_levels'; -- all_levels, beginner, intermediate, advanced
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS primary_language text DEFAULT 'en';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS secondary_language text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS highlights jsonb DEFAULT '[]'::jsonb; -- string array, no limit
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_is_included jsonb DEFAULT '[]'::jsonb;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_is_not_included jsonb DEFAULT '[]'::jsonb;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS prerequisites text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_to_bring text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS what_to_expect text; -- separate from description
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS faqs jsonb DEFAULT '[]'::jsonb; -- [{question, answer}]
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS cancellation_policy text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS welcome_message text; -- shown to confirmed guests

-- Scheduling
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS check_in_time time DEFAULT '15:00';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS check_out_time time DEFAULT '11:00';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS registration_deadline date;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS min_capacity int;

-- Restrictions
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS minimum_age int;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS maximum_age int;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS requires_application boolean DEFAULT false;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false; -- admin/team can flag

-- Certification
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS ryt_hours numeric;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS certificate_offered boolean DEFAULT false;

-- Add-ons toggle
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS addons_enabled boolean DEFAULT true;

-- Location (for off-site retreats)
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS nearest_airport text;
```

---

## 2. Retreat Types Enum

Stored as `text` on retreats (not a Postgres ENUM — allows `custom` fallback). Alphabetized reference list used for dropdowns:

```
adventure
ayahuasca_ceremony
ayurveda
breathwork
couples
creativity
detox_cleanse
digital_detox
fasting
fitness_bootcamp
longevity
meditation
mindfulness
nutrition
personal_development
plant_medicine
prenatal
recovery_rehab
reiki
retreat_leader_training
silence
sound_healing
spiritual
surf
tantra
teacher_training_200hr
teacher_training_300hr
teacher_training_500hr
wellness
womens
mens
yoga
yoga_and_surf
custom  ← uses retreat_type_custom text field
```

This list is stored as a config/seed, not a Postgres ENUM, so new types can be added without a migration. The UI will render a searchable dropdown with these options + "Custom" at the bottom.

---

## 3. Retreat Media

Replace the unstructured `images` JSONB with a proper table. Keep `images` temporarily for backward compat but migrate to:

```sql
CREATE TABLE retreat_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  url text NOT NULL,
  media_type text NOT NULL DEFAULT 'photo', -- 'photo', 'video', 'virtual_tour'
  purpose text DEFAULT 'gallery', -- 'hero', 'gallery', 'og_image', 'leader_headshot'
  caption text,
  alt_text text, -- accessibility + SEO
  sort_order int DEFAULT 0,
  width int,
  height int,
  file_size int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_retreat_media_retreat ON retreat_media(retreat_id);
CREATE INDEX idx_retreat_media_purpose ON retreat_media(retreat_id, purpose);

ALTER TABLE retreat_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_media FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON retreat_media FOR SELECT USING (true);
```

`purpose` values:
- `hero` — the main feature image (at most one per retreat)
- `gallery` — additional images
- `og_image` — Open Graph / social sharing image (at most one)
- `leader_headshot` — retreat leader photo (linked via `person_id` in retreat_teachers)

---

## 4. People Integration — Retreat Leader Roles

Retreat leaders are **people with specific roles**, not a parallel system. New role slugs to add to the `roles` seed:

```sql
INSERT INTO roles (slug, name, description, category, access_level, sort_order) VALUES
  ('retreat_leader', 'Retreat Leader', 'Primary retreat leader/teacher — has their own portal view', 'education', 3, 50),
  ('retreat_co_teacher', 'Retreat Co-Teacher', 'Co-teacher who shares teaching duties', 'education', 2, 51),
  ('retreat_assistant', 'Retreat Assistant', 'Assists the lead teacher during the retreat', 'education', 2, 52),
  ('retreat_guest_speaker', 'Retreat Guest Speaker', 'Guest presenter for specific sessions', 'education', 2, 53)
ON CONFLICT (slug) DO NOTHING;
```

These roles work within the existing `person_roles` system:
- A person gets `retreat_leader` role via `person_roles` with `starts_at`/`ends_at` and `employment_type`
- Their access_level (3) gives them staff-level portal access
- RLS policies filter what they can see to **only their own retreats and guests**

The existing `yoga_teacher` and `facilitator` roles remain for general practitioners. The new roles are specifically for retreat-level access control.

---

## 5. Retreat Teachers Junction

Replaces the single `leader_person_id` column. Supports multiple teachers per retreat with distinct roles.

```sql
CREATE TABLE retreat_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'lead', -- 'lead', 'co_teacher', 'assistant', 'guest_speaker', 'facilitator'
  is_primary boolean DEFAULT false, -- whose name leads the listing
  bio_override text, -- custom bio just for this retreat (overrides profile bio)
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(retreat_id, person_id)
);

CREATE INDEX idx_retreat_teachers_retreat ON retreat_teachers(retreat_id);
CREATE INDEX idx_retreat_teachers_person ON retreat_teachers(person_id);

ALTER TABLE retreat_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON retreat_teachers FOR SELECT USING (true);
```

Keep `leader_person_id` on retreats temporarily for backward compat. The source of truth moves to `retreat_teachers WHERE is_primary = true`.

---

## 6. Teacher Profiles (Public)

Public-facing teacher data for the website. Linked to `persons` — not a parallel people system.

```sql
CREATE TABLE teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES persons(id) ON DELETE CASCADE,

  -- Bio content
  short_bio text DEFAULT '', -- 2-3 sentences for cards
  public_bio text DEFAULT '', -- long-form for teacher page
  teaching_style text DEFAULT '', -- "Vinyasa-informed, somatic, trauma-aware"
  years_experience int,

  -- Credentials
  certifications jsonb DEFAULT '[]'::jsonb, -- [{name, issuer, year}]
  specialties text[] DEFAULT '{}', -- ["Vinyasa", "Breathwork", "Meditation"]
  languages text[] DEFAULT '{en}',

  -- Media
  photo_url text, -- professional headshot
  banner_image_url text, -- wide banner for teacher page
  intro_video_url text,

  -- Links
  website_url text,
  social_links jsonb DEFAULT '{}'::jsonb, -- {instagram, facebook, youtube, spotify, tiktok, linkedin}

  -- Website
  website_slug text UNIQUE, -- /teachers/[slug]
  meta_description text,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON teacher_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read active profiles" ON teacher_profiles FOR SELECT USING (is_active = true);
```

---

## 7. Retreat Website & SEO Fields

New columns on `retreats` for the Website & SEO section:

```sql
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS website_slug text UNIQUE;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS structured_data jsonb DEFAULT '{}'::jsonb; -- JSON-LD / Agentic Schema
```

`structured_data` holds the JSON-LD schema markup for the retreat page. Initially empty — will be populated by templates or AI tools later. Example structure:

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "...",
  "startDate": "...",
  "endDate": "...",
  "location": { "@type": "Place", "name": "Anamaya Resort", ... },
  "offers": { "@type": "Offer", "price": "...", "priceCurrency": "USD" },
  "organizer": { "@type": "Person", "name": "..." }
}
```

RLS: anon can read `website_slug`, `meta_title`, `meta_description`, `structured_data` on retreats WHERE `is_public = true AND status != 'draft'`.

---

## 8. Pricing: Tiers, Dynamic, & Bonding Curve

### Pricing Model Enum

New column on `retreats`:

```sql
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS pricing_model text DEFAULT 'fixed';
-- Values: 'fixed', 'tiered', 'dynamic', 'dynamic_plus'
```

| Model | Description |
|---|---|
| `fixed` | One price per lodging type. Current behavior. |
| `tiered` | Up to 3 time-based tiers (Early Bird / Standard / Late). Price changes on cutoff dates. |
| `dynamic` | Same as tiered but with automatic tier advancement when cutoff dates pass. |
| `dynamic_plus` | Bonding curve. Leader sets a start price and an end price at full capacity. Price increases linearly based on bookings_count / max_capacity. Encourages early booking. |

### Pricing Tiers Table

```sql
CREATE TABLE retreat_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  name text NOT NULL, -- 'Early Bird', 'Standard', 'Late Registration'
  tier_order int NOT NULL DEFAULT 0, -- 0=earliest, 1=middle, 2=latest
  price numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  cutoff_date date, -- null = no expiry (last tier)
  spaces_total int, -- null = no cap for this tier
  spaces_sold int DEFAULT 0,
  lodging_type_id uuid REFERENCES lodging_types(id) ON DELETE SET NULL, -- null = applies to all
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pricing_tiers_retreat ON retreat_pricing_tiers(retreat_id);

ALTER TABLE retreat_pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_pricing_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read active tiers" ON retreat_pricing_tiers FOR SELECT USING (is_active = true);
```

### Dynamic+ (Bonding Curve) Fields

For `pricing_model = 'dynamic_plus'`, these columns on `retreats` control the curve:

```sql
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS curve_start_price numeric(10,2);
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS curve_end_price numeric(10,2);
```

The current price is calculated as:

```
current_price = curve_start_price + (curve_end_price - curve_start_price) * (bookings_count / max_capacity)
```

This is computed at query time, not stored.

---

## 9. Deposits

Modification to existing column:

```sql
-- deposit_percentage already exists (default 60). Change default to 50.
ALTER TABLE retreats ALTER COLUMN deposit_percentage SET DEFAULT 50;

-- Who can change it: only retreat leaders with is_private_retreat = true
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS is_private_retreat boolean DEFAULT false;
```

Rules (enforced in application logic, not SQL):
- Default deposit: **50%** for all retreats
- For `is_private_retreat = true`: the retreat leader can override the deposit percentage
- For non-private retreats: deposit is always 50%, not editable by retreat leader

---

## 10. Retreat Add-Ons

```sql
CREATE TABLE retreat_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price numeric(10,2), -- null = use product.base_price
  is_required boolean DEFAULT false,
  max_per_booking int DEFAULT 1,
  description_override text, -- custom description for this retreat context
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_retreat_addons_retreat ON retreat_addons(retreat_id);

ALTER TABLE retreat_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_addons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read active addons" ON retreat_addons FOR SELECT USING (is_active = true);
```

Controlled by `retreats.addons_enabled` — if `false`, the add-ons section doesn't appear in the booking flow at all.

---

## 11. Applications & Intake Forms

Two distinct form types, each with template questions that the retreat leader can customize.

### Form Definitions

```sql
CREATE TABLE retreat_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  form_type text NOT NULL, -- 'application' (pre-booking) or 'intake' (post-booking)
  is_enabled boolean DEFAULT false, -- retreat leader opts in/out
  title text DEFAULT '',
  description text DEFAULT '', -- instructions shown at the top
  created_from_template text, -- which template was used to seed this
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(retreat_id, form_type)
);

CREATE INDEX idx_retreat_forms_retreat ON retreat_forms(retreat_id);
```

### Form Questions

```sql
CREATE TABLE retreat_form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES retreat_forms(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_type text NOT NULL DEFAULT 'text',
    -- 'text', 'textarea', 'select', 'multiselect', 'checkbox', 'number', 'date', 'file', 'rating'
  options jsonb DEFAULT '[]'::jsonb, -- for select/multiselect: ["Option A","Option B"]
  is_required boolean DEFAULT false,
  help_text text, -- instructions or context shown below the question
  placeholder text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_form_questions_form ON retreat_form_questions(form_id);
```

### Form Responses

```sql
CREATE TABLE retreat_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES retreat_forms(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  status text DEFAULT 'submitted', -- 'submitted', 'under_review', 'approved', 'declined', 'info_requested'
  reviewed_by uuid REFERENCES persons(id), -- retreat leader or admin who reviewed
  reviewed_at timestamptz,
  review_notes text, -- internal notes from reviewer
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_form_responses_form ON retreat_form_responses(form_id);
CREATE INDEX idx_form_responses_person ON retreat_form_responses(person_id);
CREATE INDEX idx_form_responses_booking ON retreat_form_responses(booking_id);
```

### Individual Question Answers

```sql
CREATE TABLE retreat_form_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES retreat_form_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES retreat_form_questions(id) ON DELETE CASCADE,
  answer_text text,
  answer_json jsonb, -- for multiselect or structured answers
  document_url text, -- for file uploads
  created_at timestamptz DEFAULT now(),
  UNIQUE(response_id, question_id)
);

CREATE INDEX idx_form_answers_response ON retreat_form_answers(response_id);
```

### Template Question Seeds

When a retreat leader enables a form, it's seeded from a template. They can then add, edit, reorder, or delete questions.

**Application Template (pre-booking):**

```sql
-- Template: 'application_general'
-- Seeded into retreat_form_questions when retreat leader enables application form

INSERT INTO retreat_form_questions (form_id, question, question_type, is_required, sort_order) VALUES
-- Background & Experience
(FORM_ID, 'How long have you been practicing yoga, and how often do you currently practice?', 'textarea', true, 1),
(FORM_ID, 'What style(s) of yoga do you typically practice?', 'multiselect', true, 2),
  -- options: ["Vinyasa","Ashtanga","Hatha","Yin","Kundalini","Iyengar","Restorative","Bikram/Hot","Other"]
(FORM_ID, 'Have you previously attended any yoga retreats, workshops, or teacher training programs? If so, which ones?', 'textarea', false, 3),
(FORM_ID, 'Describe your experience with meditation or breathwork, including frequency and tradition.', 'textarea', false, 4),

-- Intentions
(FORM_ID, 'Why do you want to attend this retreat? What do you most hope to gain?', 'textarea', true, 5),
(FORM_ID, 'How do you see yourself using the skills and knowledge from this program?', 'textarea', false, 6),
  -- help_text: 'E.g., studio teaching, personal growth, integrating into another profession'

-- Health Screening
(FORM_ID, 'Describe any injuries, disabilities, physical limitations, or illnesses we should be aware of.', 'textarea', true, 7),
(FORM_ID, 'Are you currently under the care of a mental health professional, or have you been in the past 12 months?', 'select', true, 8),
  -- options: ["No","Yes — currently","Yes — within the past 12 months"]
(FORM_ID, 'Are you currently taking any psychiatric or prescription medications?', 'select', true, 9),
  -- options: ["No","Yes"]
(FORM_ID, 'If yes, please provide details about your medications.', 'textarea', false, 10),
  -- help_text: 'This information is kept confidential and is used only to ensure your safety.'
(FORM_ID, 'What is your current fitness level?', 'select', true, 11),
  -- options: ["Beginner","Moderate","Active","Very Active"]

-- Personal
(FORM_ID, 'Is there anything else you would like us to know about you?', 'textarea', false, 12);
```

**Application Template (YTT-specific, extends general):**

Additional questions seeded when `retreat_type` is `teacher_training_200hr`, `teacher_training_300hr`, or `teacher_training_500hr`:

```sql
(FORM_ID, 'Write a short essay on why you want to learn to teach yoga.', 'textarea', true, 13),
(FORM_ID, 'List books you have read related to yoga, meditation, or eastern philosophy.', 'textarea', false, 14),
(FORM_ID, 'Do you have any prior teaching experience (any subject)?', 'textarea', false, 15),
(FORM_ID, 'If applicable, provide your existing Yoga Alliance credentials (RYT-200, RYT-500, E-RYT, etc.).', 'text', false, 16);
```

**Intake Template (post-booking):**

```sql
-- Template: 'intake_general'

-- Health & Medical
(FORM_ID, 'Please list any medical conditions, allergies, or injuries the retreat team should be aware of.', 'textarea', true, 1),
(FORM_ID, 'List all medications and supplements you are currently taking.', 'textarea', false, 2),
(FORM_ID, 'Do you have any mobility limitations or accessibility needs?', 'textarea', false, 3),
(FORM_ID, 'Are you currently pregnant or is there any chance you may be pregnant?', 'select', false, 4),
  -- options: ["No","Yes","Prefer not to say"]

-- Dietary
(FORM_ID, 'Do you have any dietary restrictions or food allergies?', 'multiselect', true, 5),
  -- options: ["None","Vegetarian","Vegan","Gluten-Free","Dairy-Free","Nut Allergy","Shellfish Allergy","Kosher","Halal","Raw Food","Other"]
(FORM_ID, 'Please provide details about any dietary needs (medical needs vs. personal preferences).', 'textarea', false, 6),

-- Travel
(FORM_ID, 'What is your planned arrival date and approximate time?', 'text', true, 7),
(FORM_ID, 'What is your planned departure date and approximate time?', 'text', true, 8),
(FORM_ID, 'What is your arrival flight number (if applicable)?', 'text', false, 9),
(FORM_ID, 'Do you need transportation from the airport?', 'select', false, 10),
  -- options: ["No — I have my own transport","Yes — please arrange pickup","I would like information about options"]
(FORM_ID, 'Do you plan to arrive early or stay late beyond the retreat dates?', 'select', false, 11),
  -- options: ["No","Yes — arriving early","Yes — staying late","Yes — both"]

-- Room
(FORM_ID, 'What is your room type preference?', 'select', true, 12),
  -- options: ["Private Room","Shared Room","Dormitory","No preference"]
(FORM_ID, 'Do you have a specific roommate request?', 'text', false, 13),
  -- help_text: 'If not, you may be paired with another guest.'
(FORM_ID, 'Any bed or accessibility preferences?', 'text', false, 14),
  -- help_text: 'E.g., lower bunk, ground floor, near bathroom'

-- Experience & Goals
(FORM_ID, 'What is your experience level with the primary retreat activity?', 'select', true, 15),
  -- options: ["Complete Beginner","Some Experience","Intermediate","Advanced"]
(FORM_ID, 'What do you most hope to gain from this retreat?', 'textarea', false, 16),

-- Emergency
(FORM_ID, 'Emergency contact: full name, relationship, phone number, and email.', 'textarea', true, 17),
(FORM_ID, 'Do you have travel insurance? If yes, provide your policy number and provider.', 'text', false, 18),

-- Consent
(FORM_ID, 'Do you consent to photos/videos being taken during the retreat for promotional use?', 'select', true, 19),
  -- options: ["Yes","No","Yes — but not my face","Please ask me first"]
(FORM_ID, 'Do you acknowledge the retreat cancellation and refund policy?', 'checkbox', true, 20);
```

---

## 12. Waitlist

```sql
CREATE TABLE retreat_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  lodging_preference text,
  position int NOT NULL DEFAULT 0,
  status text DEFAULT 'waiting', -- 'waiting', 'notified', 'converted', 'expired', 'declined'
  signed_up_at timestamptz DEFAULT now(),
  notified_at timestamptz,
  notes text
);

CREATE INDEX idx_waitlist_retreat ON retreat_waitlist(retreat_id);
CREATE INDEX idx_waitlist_status ON retreat_waitlist(retreat_id, status);

ALTER TABLE retreat_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_waitlist FOR ALL USING (true) WITH CHECK (true);
```

---

## 13. Guest Cohort Visibility

New columns on `bookings` for opt-in sharing:

```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_name_in_cohort boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_travel_in_cohort boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS share_room_in_cohort boolean DEFAULT false;
```

### Cohort View

A Postgres view for querying visible cohort info. What's exposed depends on each guest's opt-in flags:

```sql
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
```

RLS: guests can only read rows where `retreat_id` matches a retreat they themselves have a deposit_paid/paid_in_full/checked_in booking for.

---

## 14. Travel & Transfers

### Transfer Bookings

```sql
CREATE TYPE transfer_vehicle_type AS ENUM (
  'shuttle', 'private_car', 'taxi', 'taxi_boat', 'local_flight',
  'public_bus', 'bus_company', 'train', 'helicopter',
  'private_plane', 'private_jet', 'other'
);

CREATE TABLE transfer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  direction text NOT NULL, -- 'arrival', 'departure'
  pickup_location text,
  dropoff_location text,
  pickup_datetime timestamptz,
  vehicle_type transfer_vehicle_type DEFAULT 'shuttle',
  vehicle_type_custom text, -- if vehicle_type = 'other'
  seats_needed int DEFAULT 1,
  confirmation_code text,
  driver_name text,
  driver_phone text,
  company_name text,
  notes text,
  status text DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
  cost numeric(10,2),
  currency text DEFAULT 'USD',
  is_visible_to_cohort boolean DEFAULT true, -- guest opts in/out of sharing
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transfers_booking ON transfer_bookings(booking_id);
CREATE INDEX idx_transfers_person ON transfer_bookings(person_id);

ALTER TABLE transfer_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON transfer_bookings FOR ALL USING (true) WITH CHECK (true);
```

A single booking can have multiple transfer_bookings (e.g., arrival shuttle + departure local flight + mid-retreat excursion transfer).

---

## 15. Travel Chat Groups

Per-retreat group chat links (WhatsApp, Telegram, etc.) for guest coordination.

```sql
CREATE TABLE retreat_chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  platform text NOT NULL, -- 'whatsapp', 'telegram', 'signal', 'slack', 'other'
  group_name text,
  url text NOT NULL, -- invite link
  description text, -- "Travel coordination", "General retreat chat"
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_groups_retreat ON retreat_chat_groups(retreat_id);

ALTER TABLE retreat_chat_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_chat_groups FOR ALL USING (true) WITH CHECK (true);
-- Guests with deposit_paid+ can read chat groups for their retreat (via app logic or RLS)
```

---

## 16. Reviews & Testimonials

### Retreat Reviews

```sql
CREATE TABLE retreat_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  overall_rating int NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL,
  would_recommend boolean,

  -- Visibility
  is_public boolean DEFAULT false, -- admin approves
  is_featured boolean DEFAULT false, -- flagged by admin or retreat leader for prominent display

  -- Responses
  resort_response text,
  resort_responded_at timestamptz,
  resort_responded_by uuid REFERENCES persons(id),
  leader_response text,
  leader_responded_at timestamptz,
  leader_responded_by uuid REFERENCES persons(id),

  -- Admin
  submitted_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES persons(id)
);

CREATE INDEX idx_reviews_retreat ON retreat_reviews(retreat_id);
CREATE INDEX idx_reviews_person ON retreat_reviews(person_id);
CREATE INDEX idx_reviews_featured ON retreat_reviews(is_featured) WHERE is_featured = true;

ALTER TABLE retreat_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read approved public reviews" ON retreat_reviews
  FOR SELECT USING (is_public = true AND approved_at IS NOT NULL);
```

### General Testimonials

Kept for future use. Not used immediately.

```sql
CREATE TABLE general_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  person_title text, -- "Yoga Teacher, New York"
  person_photo_url text,
  body text NOT NULL,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL,
  is_featured boolean DEFAULT false,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE general_testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON general_testimonials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read active" ON general_testimonials FOR SELECT USING (is_active = true);
```

---

## 17. Promo Codes & Discounts

### Promo Codes

```sql
CREATE TABLE promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text, -- internal label
  discount_type text NOT NULL, -- 'percent', 'fixed'
  discount_value numeric(10,2) NOT NULL, -- e.g., 10.00 for 10% or $10
  currency text DEFAULT 'USD', -- for 'fixed' type

  -- Scope
  applies_to text DEFAULT 'all', -- 'all', 'specific_retreats', 'specific_lodging_types'
  retreat_ids jsonb DEFAULT '[]'::jsonb, -- uuid array if applies_to = 'specific_retreats'
  lodging_type_ids jsonb DEFAULT '[]'::jsonb,

  -- Limits
  min_booking_amount numeric(10,2),
  max_uses int, -- null = unlimited
  uses_count int DEFAULT 0,
  is_single_use_per_person boolean DEFAULT false,
  valid_from timestamptz,
  valid_until timestamptz,

  -- Stacking
  is_stackable boolean DEFAULT false, -- can be combined with other discounts
  -- if false, this code is exclusive and can't be used with any other discount

  is_active boolean DEFAULT true,
  created_by uuid REFERENCES persons(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON promo_codes FOR ALL USING (true) WITH CHECK (true);
```

### Booking Discounts Applied

A single booking can have **multiple** discount sources. This replaces the simple `promo_code_id` FK approach.

```sql
CREATE TABLE booking_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  discount_source text NOT NULL,
    -- 'promo_code', 'repeat_guest', 'ambassador', 'group', 'early_bird',
    -- 'staff', 'retreat_leader_comp', 'loyalty', 'referral', 'custom'
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  discount_type text NOT NULL, -- 'percent', 'fixed'
  discount_value numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) NOT NULL, -- actual $ amount after calculation
  currency text DEFAULT 'USD',
  description text, -- "Repeat guest 10%", "Ambassador discount", "EARLYBIRD promo code"
  applied_by uuid REFERENCES persons(id), -- who applied it (staff, system, or self)
  applied_at timestamptz DEFAULT now()
);

CREATE INDEX idx_booking_discounts_booking ON booking_discounts(booking_id);

ALTER TABLE booking_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON booking_discounts FOR ALL USING (true) WITH CHECK (true);
```

---

## 18. Documents & Waivers

### Signed Documents with Legal Provenance

```sql
CREATE TABLE signed_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL,

  -- Document info
  document_type text NOT NULL, -- 'liability_waiver', 'photo_release', 'terms', 'health_declaration', 'code_of_conduct'
  document_version text, -- "v2.1"
  document_template_url text, -- the blank template/PDF they were shown

  -- Signing
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  signature_data text, -- base64 PNG of drawn signature (optional)

  -- Storage & Proof
  document_url text NOT NULL, -- where the fully assembled, signed PDF is stored (Supabase Storage)
  document_hash text, -- SHA-256 of the final PDF
  is_public boolean DEFAULT false, -- whether the document_url is publicly accessible
  public_description_key text, -- if private, a description for what the doc contains
  blockchain_tx_url text, -- URL to blockchain transaction proving doc hash existed at signed_at
  bucket_path text, -- Supabase Storage path: e.g., "waivers/{person_id}/{retreat_id}/{id}.pdf"

  -- Status
  is_current boolean DEFAULT true, -- false if superseded by a newer version
  superseded_by uuid REFERENCES signed_documents(id),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_signed_docs_person ON signed_documents(person_id);
CREATE INDEX idx_signed_docs_booking ON signed_documents(booking_id);
CREATE INDEX idx_signed_docs_retreat ON signed_documents(retreat_id);

ALTER TABLE signed_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON signed_documents FOR ALL USING (true) WITH CHECK (true);
```

Workflow:
1. Guest opens the waiver/document in the UI
2. Guest signs (drawn signature or checkbox acknowledgment)
3. System assembles a visual PDF snapshot including: document text, signature, timestamp, IP, guest name
4. PDF is uploaded to Supabase Storage at `waivers/{person_id}/{retreat_id}/{doc_id}.pdf`
5. SHA-256 hash of the PDF is computed and stored in `document_hash`
6. (Optional) Hash is submitted to a blockchain/timestamping service; the transaction URL is stored in `blockchain_tx_url`

---

## 19. Certificates

```sql
CREATE TABLE retreat_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  retreat_id uuid NOT NULL REFERENCES retreats(id) ON DELETE CASCADE,
  certificate_type text NOT NULL, -- 'RYT-200', 'RYT-500', 'CEU', 'completion'
  hours_awarded numeric,
  issued_at timestamptz DEFAULT now(),
  certificate_url text, -- PDF in Supabase Storage
  certificate_number text UNIQUE, -- printed on the certificate
  issuing_org text DEFAULT 'Anamaya Resort',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_certificates_person ON retreat_certificates(person_id);
CREATE INDEX idx_certificates_retreat ON retreat_certificates(retreat_id);

ALTER TABLE retreat_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON retreat_certificates FOR ALL USING (true) WITH CHECK (true);
```

---

## 20. Communication Log

Captures ALL communication with a guest — automated emails, WhatsApp, Telegram, phone calls, manual entries — in one sequential timeline.

```sql
CREATE TABLE communication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL,

  -- Channel
  channel text NOT NULL,
    -- 'email', 'sms', 'whatsapp', 'telegram', 'phone_call', 'in_person', 'slack', 'other'
  direction text NOT NULL DEFAULT 'outbound', -- 'outbound', 'inbound'

  -- Content
  subject text,
  body_preview text, -- first ~500 chars (full body stored elsewhere or in body_full)
  body_full text, -- complete message (for phone call summaries, etc.)

  -- Metadata
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text DEFAULT 'sent', -- 'sent', 'delivered', 'bounced', 'read', 'failed'
  sent_by uuid REFERENCES persons(id), -- null = system/bot
  template_id text, -- which email template was used (if automated)

  -- Manual entries
  is_manual_entry boolean DEFAULT false, -- true = human logged this (e.g., phone call summary)
  call_duration_minutes int, -- for phone calls

  -- Source
  external_message_id text, -- WhatsApp/Telegram message ID for deduplication
  source_bot text, -- which bot/integration captured this ('whatsapp_bot', 'telegram_bot', etc.)

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_comms_person ON communication_log(person_id);
CREATE INDEX idx_comms_booking ON communication_log(booking_id);
CREATE INDEX idx_comms_retreat ON communication_log(retreat_id);
CREATE INDEX idx_comms_channel ON communication_log(channel);
CREATE INDEX idx_comms_sent_at ON communication_log(sent_at DESC);

ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON communication_log FOR ALL USING (true) WITH CHECK (true);
```

---

## 21. Guest Notes (Private)

Separate schema for private internal notes about guests. Written by team members or retreat leaders. Never visible to the guest.

```sql
CREATE TABLE guest_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  author_person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  retreat_id uuid REFERENCES retreats(id) ON DELETE SET NULL, -- null = general note about this guest
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,

  note_type text DEFAULT 'general',
    -- 'general', 'preference', 'concern', 'medical', 'behavioral', 'positive', 'followup'
  body text NOT NULL,
  is_flagged boolean DEFAULT false, -- important / needs attention

  -- Visibility
  visible_to text DEFAULT 'team', -- 'team' (staff+admin), 'retreat_leader' (only leaders of this guest's retreats), 'admin_only'

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_guest_notes_guest ON guest_notes(guest_person_id);
CREATE INDEX idx_guest_notes_retreat ON guest_notes(retreat_id);
CREATE INDEX idx_guest_notes_author ON guest_notes(author_person_id);

ALTER TABLE guest_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON guest_notes FOR ALL USING (true) WITH CHECK (true);
-- Retreat leaders can read notes where visible_to IN ('team', 'retreat_leader')
-- AND the guest is on one of their retreats
```

---

## 22. Persons Table Additions

```sql
ALTER TABLE persons ADD COLUMN IF NOT EXISTS passport_expiry date;
```

---

## 23. Guest Details Additions

```sql
-- Structured dietary preferences alongside existing free-text field
ALTER TABLE guest_details ADD COLUMN IF NOT EXISTS dietary_preferences text[] DEFAULT '{}';
  -- Values: 'vegan','vegetarian','pescatarian','gluten_free','dairy_free',
  -- 'nut_allergy','shellfish_allergy','kosher','halal','raw_food','other'
  -- Keep existing dietary_restrictions TEXT for details/notes
```

---

## 24. Bookings Table Additions

```sql
-- Travel documents
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS travel_insurance_provider text;
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS travel_insurance_policy text;
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS travel_insurance_dates text;
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS visa_notes text;

-- UTM tracking on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign text;
```

---

## 25. RLS & Access Control Rules

### Role-Based Visibility Matrix

| Data | Public / Website (anon) | Guest (own retreat, deposit_paid+) | Retreat Leader (their retreats) | Team (access_level 3+) | Admin (5+) |
|---|---|---|---|---|---|
| Retreat basic info | is_public=true, status!=draft | All their retreats | All their retreats | All | All |
| Retreat pricing | Active tiers only | Active tiers | All tiers | All | All |
| Teacher profiles | is_active=true | All active | All active | All | All |
| Retreat media | All for public retreats | All | All (can edit) | All | All |
| Guest cohort | --- | Opted-in fields only | Full names + travel + room | Full | Full |
| Bookings | --- | Own booking only | Their retreat bookings (no financials if access_level < 4) | All | All |
| Financials (amounts, payments) | --- | Own only | Only if granted (default: no) | All | All |
| Application/Intake responses | --- | Own responses | Their retreat responses | All | All |
| Guest notes | --- | NEVER | Notes where visible_to includes retreat_leader | visible_to includes team | All |
| Transfer bookings | --- | Own + cohort opted-in | Their retreat transfers | All | All |
| Communication log | --- | NEVER | Their retreat comms | All | All |
| Reviews | Approved public only | All approved | All for their retreats | All | All |
| Signed documents | --- | Own documents | NEVER (legal privacy) | All | All |
| Promo codes | --- | NEVER | NEVER | Read | Full |

### Key RLS Policies to Implement

1. **Retreats anon read**: `is_public = true AND status NOT IN ('draft', 'cancelled')`
2. **Retreat leader scoping**: all retreat-leader-visible queries filter through `retreat_teachers WHERE person_id = auth.uid()`
3. **Guest cohort**: filter through `bookings WHERE retreat_id = target AND person_id = auth.uid() AND status IN ('deposit_paid','paid_in_full','checked_in')`
4. **Guest notes NEVER visible to guests**: no guest-role policy on `guest_notes`
5. **Signed documents**: guests see only their own (`person_id = auth.uid()`)

---

## Migration File Plan

All of this should be implemented as a single migration file:

```
supabase/migrations/00027_retreat_schema_expansion.sql
```

Contents in order:
1. New enums (`transfer_vehicle_type`)
2. ALTER TABLE additions to `retreats`, `persons`, `guest_details`, `booking_participants`, `leads`
3. New role seeds
4. New tables in dependency order:
   - `retreat_media`
   - `retreat_teachers`
   - `teacher_profiles`
   - `retreat_pricing_tiers`
   - `retreat_addons`
   - `retreat_forms` → `retreat_form_questions` → `retreat_form_responses` → `retreat_form_answers`
   - `retreat_waitlist`
   - `transfer_bookings`
   - `retreat_chat_groups`
   - `retreat_reviews`
   - `general_testimonials`
   - `promo_codes` → `booking_discounts`
   - `signed_documents`
   - `retreat_certificates`
   - `communication_log`
   - `guest_notes`
5. Indexes
6. RLS policies
7. Cohort view

---

## New Table Count

| # | Table | Purpose |
|---|---|---|
| 1 | `retreat_media` | Structured images/video per retreat |
| 2 | `retreat_teachers` | Multiple teachers per retreat |
| 3 | `teacher_profiles` | Public-facing teacher bios for website |
| 4 | `retreat_pricing_tiers` | Structured pricing with early-bird/late tiers |
| 5 | `retreat_addons` | Per-retreat add-on products |
| 6 | `retreat_forms` | Application and intake form definitions |
| 7 | `retreat_form_questions` | Questions within forms |
| 8 | `retreat_form_responses` | Submitted response headers |
| 9 | `retreat_form_answers` | Individual question answers |
| 10 | `retreat_waitlist` | Waitlist entries |
| 11 | `transfer_bookings` | Ground/air transfer reservations |
| 12 | `retreat_chat_groups` | Group chat links per retreat |
| 13 | `retreat_reviews` | Guest reviews with resort + leader responses |
| 14 | `general_testimonials` | Generic testimonials (future use) |
| 15 | `promo_codes` | Discount codes |
| 16 | `booking_discounts` | Applied discounts per booking (multi-source) |
| 17 | `signed_documents` | Versioned waivers with legal provenance |
| 18 | `retreat_certificates` | Issued certificates (YTT, CEU) |
| 19 | `communication_log` | Unified comms timeline |
| 20 | `guest_notes` | Private notes about guests |

**20 new tables + ~25 new columns on existing tables + 1 view + 4 new role seeds + 1 new enum.**
