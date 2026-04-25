# Retreat Schema Audit — Missing & Recommended Fields
*AnamayOS + Anamaya-Website, 2026-04-25*

This document audits the current schema against what a full-featured retreat booking and website system needs. Each item is numbered so you can respond yes/no. Items marked **[website]** are needed primarily for anamaya-website display. Items marked **[ops]** are primarily internal/operational. Items marked **[both]** serve both.

---

## What We Have (Quick Summary)

**Retreats table:** name, description, excerpt, dates, status, leader (single), categories (text array), pricing_options (JSONB blob), deposit_percentage, max_capacity, available_spaces, images (JSONB blob), external_link, registration_link, notes, is_public.

**Retreat leaders:** only a single `leader_person_id` FK. Internal practitioner_details has bio, specialties, certifications — but no public profile structure.

**Bookings:** reference_code, person, retreat, room, status pipeline, bed_arrangement (text), questions (JSONB blob).

**booking_participants:** full name, email, phone, arrival/departure flights and dates, transport pickup/dropoff text fields, dietary_requirements.

**Guests (guest_details):** dietary restrictions (plain text), accessibility, emergency contacts, medical conditions, waiver_signed, yoga_experience, room_preference, retreat_interests.

**Missing:** almost everything needed for website display, structured pricing, waitlist, intake forms, teacher public profiles, cohort visibility, reviews, promo codes, and more. Details below.

---

## Section A — Retreats: Public-Facing / Website Content

These fields are needed on the `retreats` table (or a linked `retreat_content` table) to power the website listing and detail pages.

**1. `tagline` (TEXT)**
A one-line marketing hook displayed on cards and previews. Example: *"Awaken your potential in the Costa Rican jungle."* Currently missing — `excerpt` is too long for cards.

**2. `feature_image_url` (TEXT)**
Single hero/banner image URL. The current `images` field is an unstructured JSONB array with no way to designate which image is the primary hero. Needed for OG previews, cards, and page headers.

**3. `video_url` (TEXT)**
Optional promo or intro video (YouTube/Vimeo embed URL or direct). Retreat Guru and WeTravel both surface this prominently on listing pages.

**4. `retreat_type` (TEXT or ENUM)**
Category of retreat: yoga, wellness, meditation, detox/cleanse, spiritual, sound healing, breathwork, adventure, surf, couples, teacher training, ayurveda, longevity. Currently only the free-text `categories` array exists — no structured type.

**5. `skill_level` (TEXT)**
All Levels / Beginner / Intermediate / Advanced. Important for website filtering and SEO.

**6. `primary_language` (TEXT, default 'en')**
Language the retreat is taught in. Different from the `language` field on persons. Needed for filtering on the website.

**7. `highlights` (JSONB — string array)**
3-6 bullet-point highlights shown at the top of the retreat page. Example: *"Daily sunrise yoga on the jungle deck"*, *"4 gourmet plant-based meals daily"*. Quick-scan selling points distinct from the long description.

**8. `what_is_included` (JSONB — string array)**
Structured "What's Included" list — accommodation, meals, yoga sessions, airport transfer, etc. Currently buried in unstructured description text.

**9. `what_is_not_included` (JSONB — string array)**
Companion to above — flights, travel insurance, personal spending, optional excursions, etc.

**10. `prerequisites` (TEXT)**
Any requirements guests must meet — minimum yoga experience, fitness level, age, contraindications. Displayed as a callout on the booking page.

**11. `itinerary` (JSONB)**
Day-by-day schedule. Structure: `[{ day: 1, label: "Arrival Day", events: [{ time: "16:00", title: "Welcome Circle", description: "..." }] }]`. This is one of the highest-traffic sections of a retreat detail page.

**12. `faqs` (JSONB — array of {question, answer})**
Per-retreat FAQ. Some questions are universal (what to bring, deposit policy) but many are retreat-specific. Needed on the website detail page.

**13. `cancellation_policy` (TEXT)**
Retreat-specific cancellation terms, which may differ from the resort's general policy. Displayed on the booking confirmation page.

**14. `minimum_age` (INT)**
Minimum guest age. If null = no restriction. Needed for website filtering and booking validation.

**15. `maximum_age` (INT, nullable)**
Optional upper age limit. Less common but relevant for some programs.

**16. `ryt_hours` (NUMERIC, nullable)**
For teacher training retreats — how many Yoga Alliance hours this retreat counts toward. Important for SEO and the yoga teacher training audience.

**17. `certificate_offered` (BOOLEAN, default false)**
Whether this retreat issues a certificate of completion (RYT, CEU, etc.).

**18. `website_slug` (TEXT, unique)**
A clean URL slug specifically for the anamaya-website retreat page. Example: `jungle-yoga-retreat-may-2026`. The internal `rg_id` and existing identifiers aren't clean enough for public URLs.

**19. `meta_title` (TEXT)**
SEO page title (overrides the default `name`). Allows keyword optimization without changing the display name.

**20. `meta_description` (TEXT)**
SEO meta description (~155 chars). Without this, Google auto-generates from body text, usually poorly.

**21. `og_image_url` (TEXT)**
Open Graph image for social sharing previews. Can default to `feature_image_url` but sometimes you want a different crop.

---

## Section B — Retreat Pricing: Structured Tiers

Currently `pricing_options` is an unstructured JSONB blob. This makes it impossible to display pricing correctly on the website, run reports, or do booking validation.

**22. New table: `retreat_pricing_tiers`**
Replace/supplement the JSONB blob with a proper table.

```
retreat_id       → retreats
name             TEXT        -- "Early Bird", "Standard", "Late Registration"
price            NUMERIC
currency         TEXT
cutoff_date      DATE        -- null = always available
spaces_total     INT         -- null = no cap on this tier
spaces_sold      INT default 0
lodging_type_id  → lodging_types  -- null = applies to all
description      TEXT
sort_order       INT
is_active        BOOLEAN
```

This enables: early-bird pricing with automatic expiry, tier-specific space caps, different prices per lodging type, and accurate display on the website.

**23. `deposit_amount` (NUMERIC, nullable) on `retreats`**
Currently only `deposit_percentage` exists. Some retreats have a fixed deposit amount (e.g., $500 flat) rather than a percentage. Need both options — if `deposit_amount` is set it takes priority.

**24. New table: `retreat_addons`**
Optional add-ons specific to this retreat (airport transfer, surf lesson, massage package, etc.) that can be selected during booking.

```
retreat_id       → retreats
product_id       → products   -- links to existing product catalog
custom_price     NUMERIC       -- null = use product base price
is_required      BOOLEAN       -- false = optional
max_per_booking  INT           -- default 1
description_override TEXT
sort_order       INT
is_active        BOOLEAN
```

---

## Section C — Multiple Teachers Per Retreat

**25. New table: `retreat_teachers`**
Currently a retreat has only one `leader_person_id`. Many retreats have co-teachers, assistant teachers, or guest speakers.

```
id               UUID
retreat_id       → retreats
person_id        → persons
role             TEXT    -- 'lead', 'co_teacher', 'assistant', 'guest_speaker', 'facilitator'
is_primary       BOOLEAN -- which teacher's name leads on the listing
bio_override     TEXT    -- custom bio just for this retreat (overrides profile bio)
sort_order       INT
```

---

## Section D — Public Teacher Profiles

`practitioner_details` holds internal data. There's no public-facing teacher profile structure for the website's "Meet Our Teachers" page or retreat listing.

**26. New table: `teacher_profiles`**
One row per person who is a publicly-featured teacher/leader.

```
id                UUID
person_id         → persons (unique)
short_bio         TEXT        -- 2-3 sentences for cards
public_bio        TEXT        -- long form for teacher page
teaching_style    TEXT        -- e.g. "Vinyasa-informed, somatic, trauma-aware"
years_experience  INT
certifications    JSONB       -- [{name, issuer, year}]
photo_url         TEXT        -- professional headshot
banner_image_url  TEXT        -- wide banner for teacher page
website_url       TEXT
social_links      JSONB       -- {instagram, facebook, youtube, spotify, tiktok}
intro_video_url   TEXT
is_featured       BOOLEAN     -- appears on Meet Our Teachers page
is_active         BOOLEAN
website_slug      TEXT        -- URL slug for /teachers/[slug] on website
meta_description  TEXT
```

**27. `has_key` flag on `teacher_profiles`**
`is_featured` (item 26 above) handles website visibility. But also need `requires_application` — some teachers only take pre-qualified students. This is a boolean on teacher_profiles.

---

## Section E — Waitlist

Currently the retreats table has only `waitlist_enabled` (boolean). There's no actual waitlist table to capture who is waiting.

**28. New table: `retreat_waitlist`**
```
id                UUID
retreat_id        → retreats
person_id         → persons (nullable — for non-registered leads)
email             TEXT        -- if person_id is null
full_name         TEXT
phone             TEXT
lodging_preference TEXT       -- which room type they want
signed_up_at      TIMESTAMPTZ
position          INT         -- order in queue
status            TEXT        -- 'waiting', 'notified', 'converted', 'expired', 'declined'
notified_at       TIMESTAMPTZ
notes             TEXT
```

---

## Section F — Custom Intake Forms

Currently `questions` on `bookings` is a raw JSONB blob. There's no way to define per-retreat intake questions, validate required fields, or report on responses.

**29. New table: `retreat_intake_questions`**
Define per-retreat intake questions.

```
id                UUID
retreat_id        → retreats
question          TEXT
question_type     TEXT  -- 'text', 'textarea', 'select', 'multiselect', 'checkbox', 'file', 'date'
options           JSONB -- for select/multiselect: ["Option A","Option B"]
is_required       BOOLEAN
help_text         TEXT
sort_order        INT
is_active         BOOLEAN
visibility        TEXT  -- 'all_guests', 'primary_only', 'staff_only'
```

**30. New table: `retreat_intake_responses`**
Guest answers to intake questions.

```
id                UUID
booking_id        → bookings
question_id       → retreat_intake_questions
response_text     TEXT
response_json     JSONB  -- for multi-select answers
document_url      TEXT   -- if question_type = 'file'
submitted_at      TIMESTAMPTZ
```

---

## Section G — Guest Cohort Visibility

Guests who've paid a deposit want to see who else is on their retreat and coordinate travel. This needs to be opt-in per guest (privacy).

**31. Sharing preferences on `bookings`**
Add columns:

```
share_name_in_cohort     BOOLEAN  default false
share_travel_in_cohort   BOOLEAN  default false  -- show arrival/departure times
share_room_in_cohort     BOOLEAN  default false  -- show which cabin/room
```

**32. New RLS-controlled view: `retreat_cohort_view`**
A Postgres view that joins bookings + booking_participants + bed_assignments, filtered by retreat_id, surfacing only fields where sharing is opted in, readable only by guests with a confirmed/deposit-paid booking on the same retreat.

```sql
-- Columns exposed via this view:
-- full_name (if share_name_in_cohort)
-- arrival_date, arrival_time, arrival_flight (if share_travel_in_cohort)
-- departure_date, departure_time, departure_flight (if share_travel_in_cohort)
-- room name (if share_room_in_cohort)
-- NOT exposed: email, phone, payment info, medical info, bed details
```

RLS policy: `auth.uid() IN (SELECT person_id FROM bookings WHERE retreat_id = this.retreat_id AND status IN ('deposit_paid','paid_in_full','checked_in'))`.

---

## Section H — Reviews & Testimonials

No review/testimonial system exists. This is critical for website social proof.

**33. New table: `retreat_reviews`**
```
id                UUID
retreat_id        → retreats
booking_id        → bookings (ensures only real guests review)
person_id         → persons
overall_rating    INT        -- 1-5
title             TEXT
body              TEXT
would_recommend   BOOLEAN
is_public         BOOLEAN  default false  -- admin approves
is_featured       BOOLEAN  default false  -- show prominently on website
submitted_at      TIMESTAMPTZ
approved_at       TIMESTAMPTZ
approved_by       → persons
resort_response   TEXT       -- resort's public reply
resort_responded_at TIMESTAMPTZ
```

**34. New table: `general_testimonials`**
Not tied to a specific retreat — for the homepage and about page.

```
id                UUID
org_id            → organizations
person_name       TEXT
person_title      TEXT   -- e.g. "Yoga Teacher, New York"
person_photo_url  TEXT
body              TEXT
retreat_id        → retreats (nullable — links back if from a retreat)
is_featured       BOOLEAN
sort_order        INT
is_active         BOOLEAN
```

---

## Section I — Promo Codes & Discounts

No promo code system exists. Discounts are applied manually at the transaction level with no tracking.

**35. New table: `promo_codes`**
```
id                UUID
code              TEXT UNIQUE
description       TEXT        -- internal label
discount_type     TEXT        -- 'percent', 'fixed'
discount_value    NUMERIC     -- percentage (e.g. 10.00) or fixed (e.g. 100.00)
currency          TEXT        -- only relevant for 'fixed' type
min_booking_amount NUMERIC    -- minimum order to qualify
max_uses          INT         -- null = unlimited
uses_count        INT default 0
valid_from        TIMESTAMPTZ
valid_until       TIMESTAMPTZ
applies_to        TEXT        -- 'all', 'specific_retreats', 'specific_lodging_types'
retreat_ids       JSONB       -- uuid array if applies_to = 'specific_retreats'
is_single_use_per_person BOOLEAN
is_active         BOOLEAN
created_by        → persons
```

**36. `promo_code_id` on `bookings`**
Track which promo code was used for a booking.

---

## Section J — Retreat Media (Structured)

Currently `images` on retreats is an unstructured JSONB array. There's no way to set alt text, captions, sort order, or designate a hero image.

**37. New table: `retreat_media`**
```
id                UUID
retreat_id        → retreats
url               TEXT
media_type        TEXT   -- 'photo', 'video', 'virtual_tour'
caption           TEXT
alt_text          TEXT   -- accessibility + SEO
is_hero           BOOLEAN  -- the primary feature image
sort_order        INT
width             INT
height            INT
file_size         INT
created_at        TIMESTAMPTZ
```

---

## Section K — Document / Waiver Versioning

Currently `waiver_signed`, `waiver_signed_at`, `waiver_document_url` sit on `guest_details` with no version tracking. If the waiver changes, you can't tell which version a guest signed.

**38. New table: `signed_documents`**
```
id                UUID
person_id         → persons
booking_id        → bookings (nullable)
document_type     TEXT  -- 'liability_waiver', 'photo_release', 'terms', 'health_declaration'
document_version  TEXT  -- e.g. "v2.1"
document_url      TEXT  -- link to the PDF they signed
signed_at         TIMESTAMPTZ
ip_address        TEXT  -- legal record
signature_data    TEXT  -- base64 PNG (optional, for drawn signatures)
is_current        BOOLEAN  -- false if superseded by a newer version signing
```

---

## Section L — Travel Documents

`passport_number` exists on persons but nothing else for international travel.

**39. `passport_expiry` (DATE) on `persons`**
Many international destinations require passports valid for 6+ months beyond travel dates. Staff need to be able to flag guests whose passports expire too soon.

**40. `travel_insurance_provider` (TEXT) on `booking_participants`**
**41. `travel_insurance_policy_number` (TEXT) on `booking_participants`**
**42. `travel_insurance_coverage_dates` (TEXT) on `booking_participants`**
Emergency contact info is already collected — travel insurance is the other thing staff need in an emergency.

**43. `visa_notes` (TEXT) on `booking_participants`**
Free-text field for staff to note visa requirements, status, or any immigration-related info specific to this trip.

---

## Section M — Structured Dietary Options

`dietary_restrictions` on `guest_details` is plain text. This makes it impossible to generate a kitchen manifest or filter by diet.

**44. `dietary_preferences` (TEXT array) on `guest_details`**
Replace or supplement free-text with a structured array. Values: `vegan`, `vegetarian`, `pescatarian`, `gluten_free`, `dairy_free`, `nut_allergy`, `shellfish_allergy`, `kosher`, `halal`, `raw_food`, `other`. Keep the existing `dietary_restrictions` text field for details.

---

## Section N — Ground Transfers / Shuttle Bookings

`booking_participants` has `transport_arrival` and `transport_departure` as plain text. There's no structured transfer booking system.

**45. New table: `transfer_bookings`**
For when the resort arranges or coordinates airport/shuttle transfers.

```
id                UUID
booking_id        → bookings
person_id         → persons
direction         TEXT        -- 'arrival', 'departure'
pickup_location   TEXT        -- airport name, hotel, etc.
dropoff_location  TEXT
pickup_datetime   TIMESTAMPTZ
vehicle_type      TEXT        -- 'shuttle', 'private_car', 'taxi', 'bus'
seats_needed      INT default 1
confirmation_code TEXT
driver_name       TEXT
driver_phone      TEXT
notes             TEXT
status            TEXT        -- 'pending', 'confirmed', 'completed', 'cancelled'
cost              NUMERIC
currency          TEXT
created_at        TIMESTAMPTZ
```

---

## Section O — Certificates Issued

For teacher training retreats and CEU programs.

**46. New table: `retreat_certificates`**
```
id                UUID
booking_id        → bookings
person_id         → persons
retreat_id        → retreats
certificate_type  TEXT   -- 'RYT-200', 'RYT-500', 'CEU', 'completion'
hours_awarded     NUMERIC
issued_at         TIMESTAMPTZ
certificate_url   TEXT   -- PDF stored in Supabase Storage
issuing_org       TEXT   -- e.g. "Yoga Alliance", "Anamaya Resort"
certificate_number TEXT  -- unique ID printed on cert
```

---

## Section P — Communication Log

No log of emails/messages sent to guests. This causes problems when staff need to see what a guest was told or when a confirmation was sent.

**47. New table: `communication_log`**
```
id                UUID
person_id         → persons
booking_id        → bookings (nullable)
channel           TEXT  -- 'email', 'sms', 'whatsapp'
direction         TEXT  -- 'outbound', 'inbound'
subject           TEXT
body_preview      TEXT  -- first 300 chars
sent_at           TIMESTAMPTZ
status            TEXT  -- 'sent', 'delivered', 'bounced', 'read', 'failed'
sent_by           → persons (nullable — null = system/automated)
template_id       TEXT  -- which email template was used
```

---

## Section Q — Minor Additions to Existing Tables

Small additions to existing tables that don't require new tables.

**48. `co_leader_person_id` (UUID → persons) on `retreats`**
A quick stopgap for retreats with exactly two teachers, without needing the full `retreat_teachers` junction table. Only add this if item **25** is declined.

**49. `location_name` (TEXT) on `retreats`**
For off-site or partner retreats not at Anamaya's main property. Example: "Blue Osa Yoga Retreat, Costa Rica." Usually empty for home retreats.

**50. `registration_deadline` (DATE) on `retreats`**
The date after which new bookings are not accepted. Currently only `registration_status` (text) exists with no date enforcement.

**51. `min_capacity` (INT) on `retreats`**
Minimum number of participants needed to run the retreat. If not met by a cutoff date, the retreat may be cancelled. Counterpart to the existing `max_capacity`.

**52. `requires_application` (BOOLEAN, default false) on `retreats`**
Some retreats require an application/approval before booking is confirmed. Triggers an application workflow instead of direct checkout.

**53. `is_sold_out` (BOOLEAN, computed or managed) on `retreats`**
Currently `available_spaces` is tracked but there's no clean `is_sold_out` flag. This should be a computed column or a maintained boolean for fast website queries without doing math.

**54. `source` (TEXT) on `leads`**
This exists already. But `utm_source`, `utm_medium`, `utm_campaign` are missing — needed to track which marketing channels produce converting leads.

**55. `utm_source`, `utm_medium`, `utm_campaign` (TEXT) on `leads`**
Marketing attribution. When a lead comes from an Instagram ad vs. a Google search vs. an email campaign, this determines where marketing budget is working.

**56. `referred_by_code` (TEXT) on `bookings`**
If item 35 (promo codes) is approved, this stores the code used. If declined, this is the simpler alternative — just record the code string.

**57. `check_in_time` (TIME, default '15:00') on `retreats`**
**58. `check_out_time` (TIME, default '11:00') on `retreats`**
Standard check-in/check-out times for the retreat, displayed on the booking confirmation and website. Currently not stored — guests don't know when to arrive.

**59. `what_to_bring` (TEXT or JSONB) on `retreats`**
Packing list / what to bring. Shown on the confirmation page and in the pre-arrival email. Often retreat-specific (jungle retreats need bug spray, ocean retreats need rash guards, etc.).

**60. `nearest_airport` (TEXT) on `retreats`**
For off-site retreats. For Anamaya's home property this can be a system-level config, but storing it per retreat supports future expansion.

---

## Section R — RLS / Access Control Rules (No New Tables)

These are policy decisions, not new columns, but they define what each role can see.

**61. Confirmed-guest cohort visibility** (described in item 32) — guests with `deposit_paid` or better can see opted-in cohort data for their retreat only.

**62. Bed assignment visibility for guests** — A guest can query their own `booking_bed_assignments`. They should NOT see other guests' bed assignments unless item 31 (share_room_in_cohort) is enabled.

**63. Retreat `is_public = false`** should be invisible to the website's anon reader. Need a policy on retreats: `SELECT WHERE is_public = true AND status != 'draft'` for anon reads.

**64. Teacher profile (`teacher_profiles`) anon read** — public teacher profiles should be readable by anamaya-website via anon key (same pattern as AI data tables). Needs `ENABLE RLS` + anon SELECT policy.

**65. `retreat_reviews` anon read** — only approved reviews (`is_public = true`, `approved_at IS NOT NULL`) are readable by anon.

---

## Priority Summary

If you only do some of these, here's the rough order of impact:

| Priority | Items | Why |
|---|---|---|
| Critical for website launch | 1, 2, 4, 5, 7, 8, 9, 18, 19, 22, 25, 26, 28, 57, 58, 59, 63, 64 | Website can't display retreats properly without these |
| High — booking flow | 29, 30, 31, 32, 35, 36, 50, 52, 53 | Intake forms, privacy, promo codes, application flow |
| High — guest experience | 10, 11, 12, 13, 33, 44, 45 | Itinerary, FAQ, reviews, dietary, transfers |
| Medium — completeness | 3, 6, 14, 15, 16, 17, 20, 21, 23, 24, 37, 38, 39, 40, 41, 42, 43 | Media, pricing tiers, legal docs |
| Nice to have | 27, 34, 46, 47, 48, 49, 51, 54, 55, 56, 60, 65, 66 | Certificates, comms log, UTM tracking, referrals |
