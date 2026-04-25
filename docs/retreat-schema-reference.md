# AnamayOS Master Schema Reference
*Human-readable listing of all data available for building UI panels*
*Updated: 2026-04-25*

---

## How to Use This Document

This is a quick-reference for what data exists in the database when building frontend panels. Each table lists its fields, types, and what they're for. No SQL — just a readable inventory.

---

## 1. Retreats

The central table for retreat programs/events.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| rg_id | int | RetreatGuru import ID |
| name | text | Display name |
| tagline | text | One-line marketing hook for cards |
| description | text | Long description (internal/general) |
| excerpt | text | Short blurb |
| what_to_expect | text | Separate detailed description for website |
| welcome_message | text | Shown to confirmed guests after booking |
| feature_image_url | text | Hero/banner image URL |
| video_url | text | Promo video (YouTube/Vimeo) |
| retreat_type | text | Category: yoga, wellness, meditation, teacher_training_200hr, custom, etc. |
| retreat_type_custom | text | Custom type name if retreat_type = 'custom' |
| skill_level | text | all_levels / beginner / intermediate / advanced |
| primary_language | text | Language of instruction (default: en) |
| secondary_language | text | Optional second language |
| highlights | jsonb (string[]) | Bullet-point selling features (no limit) |
| what_is_included | jsonb (string[]) | What's included: meals, accommodation, sessions, etc. |
| what_is_not_included | jsonb (string[]) | What's NOT included: flights, insurance, etc. |
| prerequisites | text | Requirements to attend (experience, fitness, etc.) |
| what_to_bring | text | Packing list / what to bring |
| itinerary | jsonb | Day-by-day schedule: [{day, label, events: [{time, title, description}]}] |
| faqs | jsonb | Per-retreat FAQ: [{question, answer}] |
| cancellation_policy | text | Retreat-specific cancellation terms |
| date_type | enum | fixed / package / hotel / dateless |
| start_date | date | Retreat start |
| end_date | date | Retreat end |
| package_nights | int | For 'package' type retreats |
| check_in_time | time | Default 15:00 |
| check_out_time | time | Default 11:00 |
| registration_deadline | date | Last date to accept new bookings |
| status | enum | draft / confirmed / cancelled / completed |
| is_public | boolean | Visible on website |
| is_featured | boolean | Highlighted in UI (set by team/admin) |
| is_sold_out | boolean | Quick flag for sold-out retreats |
| is_active | boolean | Soft delete |
| registration_status | text | open / closed / waitlist |
| waitlist_enabled | boolean | Whether waitlist is active |
| requires_application | boolean | Pre-booking application required |
| is_private_retreat | boolean | Private retreat (leader can adjust deposit %) |
| leader_person_id | uuid → persons | Legacy single-leader FK (use retreat_teachers instead) |
| categories | text[] | Category tags |
| pricing_model | text | fixed / tiered / dynamic / dynamic_plus |
| pricing_type | enum | tiered / lodging |
| pricing_options | jsonb | Legacy pricing blob |
| curve_start_price | numeric | For dynamic_plus: price at 0 bookings |
| curve_end_price | numeric | For dynamic_plus: price when full |
| deposit_percentage | int | Default 50%. Leaders can change for private retreats only |
| max_capacity | int | Maximum participants |
| min_capacity | int | Minimum to run the retreat |
| available_spaces | int | Remaining spots |
| minimum_age | int | Min guest age (null = no limit) |
| maximum_age | int | Max guest age (null = no limit) |
| ryt_hours | numeric | Yoga Alliance hours awarded |
| certificate_offered | boolean | Issues a certificate |
| addons_enabled | boolean | Whether add-ons section appears in booking |
| location_name | text | For off-site retreats |
| nearest_airport | text | Airport code/name |
| currency | text | Default USD |
| website_slug | text | URL slug for website: /retreats/[slug] |
| meta_title | text | SEO page title |
| meta_description | text | SEO description (~155 chars) |
| structured_data | jsonb | JSON-LD / Agentic Schema markup |
| images | jsonb | Legacy image array (migrate to retreat_media) |
| program_info | jsonb | Flexible program metadata |
| external_link | text | Link to external page |
| registration_link | text | External registration URL |
| notes | text | Internal notes |

---

## 2. Retreat Media

Structured images/video per retreat. Replaces the unstructured `images` JSONB.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| url | text | Media file URL |
| media_type | text | photo / video / virtual_tour |
| purpose | text | hero / gallery / og_image / leader_headshot |
| caption | text | Display caption |
| alt_text | text | Accessibility + SEO alt text |
| sort_order | int | Display order within type |
| width | int | Image width in px |
| height | int | Image height in px |
| file_size | int | Bytes |

---

## 3. Retreat Teachers

Multiple teachers per retreat with roles. Replaces the single `leader_person_id`.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| person_id | uuid → persons | Which person |
| role | text | lead / co_teacher / assistant / guest_speaker / facilitator |
| is_primary | boolean | Whose name leads the listing |
| bio_override | text | Custom bio for this specific retreat |
| sort_order | int | Display order |

---

## 4. Teacher Profiles (Public)

Public-facing bios for the website. One per person. Linked to the `persons` table, not separate.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| person_id | uuid → persons | Linked person (unique) |
| short_bio | text | 2-3 sentences for cards |
| public_bio | text | Long-form for dedicated teacher page |
| teaching_style | text | e.g. "Vinyasa-informed, somatic, trauma-aware" |
| years_experience | int | Years teaching |
| certifications | jsonb | [{name, issuer, year}] |
| specialties | text[] | ["Vinyasa", "Breathwork", "Meditation"] |
| languages | text[] | Languages they teach in |
| photo_url | text | Professional headshot |
| banner_image_url | text | Wide banner for teacher detail page |
| intro_video_url | text | Video introduction |
| website_url | text | Personal website |
| social_links | jsonb | {instagram, facebook, youtube, spotify, tiktok, linkedin} |
| website_slug | text | URL: /teachers/[slug] |
| meta_description | text | SEO description |
| is_featured | boolean | Appears on "Meet Our Teachers" website page |
| is_active | boolean | Visible to public |

---

## 5. Retreat Pricing Tiers

Structured pricing per retreat. Supports early-bird / standard / late tiers.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| name | text | "Early Bird", "Standard", "Late Registration" |
| tier_order | int | 0 = earliest, 1 = middle, 2 = latest |
| price | numeric | Price for this tier |
| currency | text | Default USD |
| cutoff_date | date | When this tier expires (null = no expiry) |
| spaces_total | int | Cap for this tier (null = unlimited) |
| spaces_sold | int | How many sold at this tier |
| lodging_type_id | uuid → lodging_types | Specific lodging (null = all) |
| description | text | What's special about this tier |
| is_active | boolean | Currently available |

---

## 6. Retreat Add-Ons

Optional products available during booking for a specific retreat.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| product_id | uuid → products | Links to product catalog |
| custom_price | numeric | Override price (null = use product base_price) |
| is_required | boolean | Must be purchased |
| max_per_booking | int | Max quantity per booking |
| description_override | text | Custom description for this retreat context |
| sort_order | int | Display order |
| is_active | boolean | Currently available |

Only shown if `retreats.addons_enabled = true`.

---

## 7. Retreat Forms (Application & Intake)

Two form types per retreat: **application** (pre-booking screening) and **intake** (post-booking info gathering).

### retreat_forms (form definitions)

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| form_type | text | 'application' or 'intake' |
| is_enabled | boolean | Leader opts in/out |
| title | text | Form heading |
| description | text | Instructions shown at top |
| created_from_template | text | Which template seeded this form |

### retreat_form_questions

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| form_id | uuid → retreat_forms | Which form |
| question | text | The question text |
| question_type | text | text / textarea / select / multiselect / checkbox / number / date / file / rating |
| options | jsonb (string[]) | For select/multiselect: ["Option A","Option B"] |
| is_required | boolean | Must answer |
| help_text | text | Instructions below the question |
| placeholder | text | Input placeholder |
| sort_order | int | Question order |
| is_active | boolean | Soft delete |

### retreat_form_responses (submitted forms)

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| form_id | uuid → retreat_forms | Which form |
| booking_id | uuid → bookings | Linked booking (null for pre-booking applications) |
| person_id | uuid → persons | Who submitted |
| status | text | submitted / under_review / approved / declined / info_requested |
| reviewed_by | uuid → persons | Who reviewed |
| reviewed_at | timestamptz | When reviewed |
| review_notes | text | Internal reviewer notes |
| submitted_at | timestamptz | When submitted |

### retreat_form_answers (individual question answers)

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| response_id | uuid → retreat_form_responses | Which submission |
| question_id | uuid → retreat_form_questions | Which question |
| answer_text | text | Text answer |
| answer_json | jsonb | Structured answer (multiselect, etc.) |
| document_url | text | File upload URL |

**Template questions:** When a leader enables a form, it's auto-seeded with ~12-20 relevant questions based on the retreat type (general, YTT, wellness). Leader can edit/add/delete/reorder.

---

## 8. Retreat Waitlist

People waiting for a spot when the retreat is full.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| person_id | uuid → persons | Registered person (null if lead only) |
| email | text | Contact email |
| full_name | text | Name |
| phone | text | Phone |
| lodging_preference | text | Which room type they want |
| position | int | Queue position |
| status | text | waiting / notified / converted / expired / declined |
| signed_up_at | timestamptz | When they joined |
| notified_at | timestamptz | When a spot opened and they were notified |
| notes | text | Any notes |

---

## 9. Transfer Bookings

Ground/air transfer reservations. Multiple per booking.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| booking_id | uuid → bookings | Which booking |
| person_id | uuid → persons | Who is being transferred |
| direction | text | arrival / departure |
| pickup_location | text | Airport name, hotel, etc. |
| dropoff_location | text | Destination |
| pickup_datetime | timestamptz | Scheduled pickup time |
| vehicle_type | enum | shuttle / private_car / taxi / taxi_boat / local_flight / public_bus / bus_company / train / helicopter / private_plane / private_jet / other |
| vehicle_type_custom | text | Custom vehicle type name if 'other' |
| seats_needed | int | How many seats |
| confirmation_code | text | Provider's confirmation number |
| driver_name | text | Driver or pilot name |
| driver_phone | text | Contact number |
| company_name | text | Transport company |
| notes | text | Special instructions |
| status | text | pending / confirmed / completed / cancelled |
| cost | numeric | Price |
| currency | text | Default USD |
| is_visible_to_cohort | boolean | Guest opts in/out of sharing travel with cohort |

---

## 10. Retreat Chat Groups

Group chat links (WhatsApp, Telegram, etc.) per retreat for guest coordination.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| platform | text | whatsapp / telegram / signal / slack / other |
| group_name | text | Display name |
| url | text | Invite/join link |
| description | text | "Travel coordination", "General retreat chat" |
| is_active | boolean | Currently active |

---

## 11. Retreat Reviews

Guest reviews with resort and leader responses.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| retreat_id | uuid → retreats | Which retreat |
| booking_id | uuid → bookings | Proves they actually attended |
| person_id | uuid → persons | Who wrote it |
| overall_rating | int (1-5) | Star rating |
| title | text | Review headline |
| body | text | Full review text |
| would_recommend | boolean | Yes/No |
| is_public | boolean | Admin-approved for website display |
| is_featured | boolean | Flagged for prominent display / auto-shows on future retreats by this leader |
| resort_response | text | Resort's public reply |
| resort_responded_at | timestamptz | When resort replied |
| resort_responded_by | uuid → persons | Who from resort replied |
| leader_response | text | Retreat leader's public reply |
| leader_responded_at | timestamptz | When leader replied |
| leader_responded_by | uuid → persons | Which leader replied |
| submitted_at | timestamptz | When guest submitted |
| approved_at | timestamptz | When admin approved for public |
| approved_by | uuid → persons | Who approved |

---

## 12. General Testimonials (Future Use)

Generic testimonials not tied to a specific retreat. For homepage/about page.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| org_id | uuid → organizations | Which organization |
| person_name | text | Testimonial author |
| person_title | text | e.g. "Yoga Teacher, New York" |
| person_photo_url | text | Author photo |
| body | text | Testimonial text |
| retreat_id | uuid → retreats | Optional link back to a retreat |
| is_featured | boolean | Show prominently |
| sort_order | int | Display order |
| is_active | boolean | Currently displayed |

---

## 13. Promo Codes

Discount codes. Can be stackable (combined with other discounts) or exclusive.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| code | text | The code guests enter (unique) |
| description | text | Internal label |
| discount_type | text | percent / fixed |
| discount_value | numeric | Amount (10.00 = 10% or $10) |
| currency | text | For fixed-amount codes |
| applies_to | text | all / specific_retreats / specific_lodging_types |
| retreat_ids | jsonb (uuid[]) | Which retreats (if scoped) |
| lodging_type_ids | jsonb (uuid[]) | Which lodging types (if scoped) |
| min_booking_amount | numeric | Minimum order to qualify |
| max_uses | int | Total uses allowed (null = unlimited) |
| uses_count | int | Times used so far |
| is_single_use_per_person | boolean | One use per guest |
| is_stackable | boolean | Can combine with other discounts |
| valid_from | timestamptz | Start date |
| valid_until | timestamptz | Expiry date |
| is_active | boolean | Currently active |
| created_by | uuid → persons | Who created it |

---

## 14. Booking Discounts

Applied discounts per booking. Multiple sources can stack on one booking.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| booking_id | uuid → bookings | Which booking |
| discount_source | text | promo_code / repeat_guest / ambassador / group / early_bird / staff / retreat_leader_comp / loyalty / referral / custom |
| promo_code_id | uuid → promo_codes | If source = promo_code |
| discount_type | text | percent / fixed |
| discount_value | numeric | The rate (10% or $100) |
| discount_amount | numeric | Actual $ saved after calculation |
| currency | text | Currency of the discount |
| description | text | "Repeat guest 10%", "EARLYBIRD promo code" |
| applied_by | uuid → persons | Who applied (staff, system, guest) |
| applied_at | timestamptz | When applied |

---

## 15. Signed Documents

Versioned waivers/contracts with legal provenance, PDF snapshots, and optional blockchain proof.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| person_id | uuid → persons | Who signed |
| booking_id | uuid → bookings | Related booking |
| retreat_id | uuid → retreats | Related retreat |
| document_type | text | liability_waiver / photo_release / terms / health_declaration / code_of_conduct |
| document_version | text | e.g. "v2.1" |
| document_template_url | text | The blank template shown to the signer |
| signed_at | timestamptz | When signed |
| ip_address | text | Signer's IP (legal record) |
| user_agent | text | Browser info |
| signature_data | text | Base64 PNG of drawn signature |
| document_url | text | URL of the assembled signed PDF |
| document_hash | text | SHA-256 of the final PDF |
| is_public | boolean | Whether the document URL is publicly accessible |
| public_description_key | text | Description key if private |
| blockchain_tx_url | text | Blockchain transaction proving doc existed at signing time |
| bucket_path | text | Supabase Storage path |
| is_current | boolean | False if superseded by newer version |
| superseded_by | uuid → signed_documents | Points to the replacement doc |

---

## 16. Retreat Certificates

Issued certificates for YTT, CEU, completion programs.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| booking_id | uuid → bookings | Which booking |
| person_id | uuid → persons | Who received it |
| retreat_id | uuid → retreats | Which retreat |
| certificate_type | text | RYT-200 / RYT-500 / CEU / completion |
| hours_awarded | numeric | Hours/credits |
| issued_at | timestamptz | When issued |
| certificate_url | text | PDF in Supabase Storage |
| certificate_number | text | Unique ID printed on cert |
| issuing_org | text | e.g. "Yoga Alliance", "Anamaya Resort" |

---

## 17. Communication Log

Unified timeline of ALL communication with a guest across every channel.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| person_id | uuid → persons | Who the communication is about |
| booking_id | uuid → bookings | Related booking |
| retreat_id | uuid → retreats | Related retreat |
| channel | text | email / sms / whatsapp / telegram / phone_call / in_person / slack / other |
| direction | text | outbound / inbound |
| subject | text | Email subject or call topic |
| body_preview | text | First ~500 chars |
| body_full | text | Complete message (important for phone call summaries) |
| sent_at | timestamptz | When it happened |
| status | text | sent / delivered / bounced / read / failed |
| sent_by | uuid → persons | Who sent/logged it (null = system/bot) |
| template_id | text | Which email template was used |
| is_manual_entry | boolean | True = human logged this (e.g. phone call) |
| call_duration_minutes | int | For phone calls |
| external_message_id | text | WhatsApp/Telegram message ID (dedup) |
| source_bot | text | Which bot captured this (whatsapp_bot, telegram_bot, etc.) |

---

## 18. Guest Notes (Private)

Internal notes about guests. Written by team or retreat leaders. NEVER visible to the guest.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| guest_person_id | uuid → persons | Who the note is about |
| author_person_id | uuid → persons | Who wrote it |
| retreat_id | uuid → retreats | Related retreat (null = general note) |
| booking_id | uuid → bookings | Related booking |
| note_type | text | general / preference / concern / medical / behavioral / positive / followup |
| body | text | The note content |
| is_flagged | boolean | Important / needs attention |
| visible_to | text | team (staff+admin) / retreat_leader (leaders of this guest's retreats) / admin_only |

---

## 19. Bookings (Existing + New Fields)

Core booking record. New fields added for cohort visibility.

| New Field | Type | What It's For |
|---|---|---|
| share_name_in_cohort | boolean | Opt-in: other guests can see this guest's name |
| share_travel_in_cohort | boolean | Opt-in: other guests can see arrival/departure info |
| share_room_in_cohort | boolean | Opt-in: other guests can see room/cabin |

*All existing booking fields (reference_code, person_id, retreat_id, room_id, status, check_in, check_out, num_guests, total_amount, etc.) remain unchanged.*

---

## 20. Booking Participants (Existing + New Fields)

Secondary guests under a booking. New fields added for travel docs.

| New Field | Type | What It's For |
|---|---|---|
| travel_insurance_provider | text | Insurance company name |
| travel_insurance_policy | text | Policy number |
| travel_insurance_dates | text | Coverage period |
| visa_notes | text | Visa requirements/status |

*All existing fields (arrival_date, departure_date, arrival_flight, departure_flight, transport_arrival, transport_departure, dietary_requirements, etc.) remain unchanged.*

---

## 21. Persons (Existing + New Fields)

| New Field | Type | What It's For |
|---|---|---|
| passport_expiry | date | Passport expiration — staff can flag guests with expiring passports |

---

## 22. Guest Details (Existing + New Fields)

| New Field | Type | What It's For |
|---|---|---|
| dietary_preferences | text[] | Structured: vegan, vegetarian, gluten_free, nut_allergy, etc. Supplements the existing free-text `dietary_restrictions` |

---

## 23. Leads (Existing + New Fields)

| New Field | Type | What It's For |
|---|---|---|
| utm_source | text | Marketing attribution: which source |
| utm_medium | text | Marketing attribution: which medium |
| utm_campaign | text | Marketing attribution: which campaign |

---

## 24. Retreat Cohort View

A Postgres view that combines booking + person + travel + room data, filtering by opt-in sharing preferences. Used to show confirmed guests what they can see about fellow retreat participants.

| Field | Visible When |
|---|---|
| display_name | Other guest opted in via share_name_in_cohort |
| avatar_url | Other guest opted in via share_name_in_cohort |
| arrival_date, arrival_time, arrival_flight | Other guest opted in via share_travel_in_cohort |
| departure_date, departure_time, departure_flight | Other guest opted in via share_travel_in_cohort |
| room_name | Other guest opted in via share_room_in_cohort |

Only visible to guests who themselves have a deposit_paid / paid_in_full / checked_in booking on the same retreat.

---

## 25. Retreat Leader Roles

New roles in the `roles` table for retreat-specific access control:

| Slug | Name | Access Level | Purpose |
|---|---|---|---|
| retreat_leader | Retreat Leader | 3 | Primary leader — gets portal with their retreats, guests, travel |
| retreat_co_teacher | Retreat Co-Teacher | 2 | Co-teacher, shares duties |
| retreat_assistant | Retreat Assistant | 2 | Assists during retreat |
| retreat_guest_speaker | Retreat Guest Speaker | 2 | Guest presenter for specific sessions |

These work within the existing `person_roles` system. A person gets a role via `person_roles` with start/end dates.

---

## 26. Organizations (Expanded Identity Fields)

The `organizations` table now includes full identity fields needed by `getOrganizationContext()` on the website side.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| name | text | Display name |
| slug | text | URL-safe identifier |
| description | text | Internal description |
| owner_id | uuid → persons | Org owner |
| legal_name | text | Legal entity name (for contracts, invoices) |
| tagline | text | One-line brand positioning |
| industry | text | e.g. "hospitality", "wellness", "education" |
| primary_offering | text | e.g. "yoga retreat", "boutique hotel" |
| locale | text | e.g. "en-US", "es-CR" |
| timezone | text | e.g. "America/Costa_Rica" |
| booking_url | text | Where the visitor agent sends booking questions |
| contact_url | text | Where the visitor agent sends general questions |
| sensitive_topics | jsonb (string[]) | Topics the visitor agent must not invent: ["prices","dates","availability"] |
| disclaimers | jsonb | { booking: "text", medical: "text", legal: "text" } — shown as footers |
| visitor_agent_enabled | boolean | Whether the visitor Q&A agent is active |
| visitor_agent_brand_guide_id | uuid → ai_brand_guide | Which brand guide drives the visitor agent's tone |
| visitor_agent_question_templates | jsonb | Per-post-type suggested questions: { "service": ["What's included?"], "event": ["When?"] } |
| is_active | boolean | Soft delete |

---

## 27. Org Properties (Sub-Brands)

An organization can operate multiple physical locations, each potentially with its own website, retreats, rooms, and staff. A "property" is a sub-brand under an org.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| org_id | uuid → organizations | Parent organization |
| name | text | Property display name |
| slug | text | URL-safe identifier (unique within org) |
| description | text | About this property |
| property_type | text | retreat_center / hotel / boutique_hotel / resort / wellness_center / yoga_studio / spa / event_venue / other |
| property_type_custom | text | Custom type name if 'other' |
| tagline | text | Can override parent org tagline |
| industry | text | Can override parent org industry |
| primary_offering | text | Can override parent org offering |
| locale | text | Can override parent org locale |
| timezone | text | Can override parent org timezone |
| booking_url | text | Property-specific booking URL |
| contact_url | text | Property-specific contact URL |
| address_line1 | text | Street address |
| address_line2 | text | Unit/suite |
| city | text | City |
| state_province | text | State or province |
| country | text | Country |
| postal_code | text | Zip/postal code |
| latitude | numeric | GPS lat |
| longitude | numeric | GPS lng |
| nearest_airport | text | Airport code/name |
| phone | text | Contact phone |
| email | text | Contact email |
| website_url | text | Property website |
| sensitive_topics | jsonb (string[]) | Override org's sensitive topics (null = inherit from org) |
| disclaimers | jsonb | Override org's disclaimers (null = inherit from org) |
| is_active | boolean | Currently operating |
| sort_order | int | Display order |

**Linked tables:** `retreats` and `rooms` now have an optional `property_id` FK so they can be scoped to a specific property within an org.

**Override pattern:** Property fields that are `null` inherit from the parent org. Non-null values override. Applies to: tagline, industry, primary_offering, locale, timezone, booking_url, contact_url, sensitive_topics, disclaimers.

---

## 28. Per-Org AI Provider Config

Scopes AI provider access per tenant. Controls which providers an org can use and which model fills each role.

| Field | Type | What It's For |
|---|---|---|
| id | uuid | Primary key |
| org_id | uuid → organizations | Which org |
| provider_id | text → ai_providers | Which provider (openai, anthropic, etc.) |
| has_key | boolean | Whether this org has a working API key |
| key_source | text | 'platform' (shared key) or 'tenant' (org provided their own) |
| role_best_text | text | Model endpoint for "best" text generation |
| role_fastest_text | text | Model endpoint for "fastest" text generation |
| role_best_image | text | Model endpoint for "best" image generation |
| is_active | boolean | Whether this provider is enabled for this org |

**Not stored here:** actual API keys. Those stay in env vars or a secrets manager. This table only tracks config and role assignments.

---

## 29. Brand Guide Visibility

New field on `ai_brand_guide`:

| Field | Type | What It's For |
|---|---|---|
| visibility | text | 'admin_only' (internal content tools) / 'public' (visitor-facing agent) / 'both' |

This lets the visitor Q&A agent use a different brand voice than the admin writing tools, or the same one.

---

## 30. Access Control Summary

| Data | Public (website) | Guest (own retreat) | Retreat Leader (their retreats) | Team (level 3+) | Admin (5+) |
|---|---|---|---|---|---|
| Retreat info | Public + non-draft only | Their retreats | Their retreats | All | All |
| Pricing tiers | Active only | Active | All | All | All |
| Teacher profiles | Active only | All active | All active | All | All |
| Media | Public retreats | All | All (can edit) | All | All |
| Cohort | --- | Opted-in only | Full | Full | Full |
| Bookings | --- | Own only | Their retreat bookings | All | All |
| Financials | --- | Own only | Default: no | All | All |
| Form responses | --- | Own only | Their retreat responses | All | All |
| Guest notes | --- | NEVER | Where visible_to includes them | Where visible_to includes team | All |
| Transfers | --- | Own + cohort opted-in | Their retreats | All | All |
| Comms log | --- | NEVER | Their retreats | All | All |
| Reviews | Approved public only | All approved | Their retreats | All | All |
| Signed docs | --- | Own only | NEVER | All | All |
| Promo codes | --- | NEVER | NEVER | Read | Full |

---

## Retreat Types (Reference List)

Used in `retreats.retreat_type`. Stored as text, not a Postgres enum.

adventure, ayahuasca_ceremony, ayurveda, breathwork, couples, creativity, detox_cleanse, digital_detox, fasting, fitness_bootcamp, longevity, meditation, mindfulness, nutrition, personal_development, plant_medicine, prenatal, recovery_rehab, reiki, retreat_leader_training, silence, sound_healing, spiritual, surf, tantra, teacher_training_200hr, teacher_training_300hr, teacher_training_500hr, wellness, womens, mens, yoga, yoga_and_surf, custom

---

## Vehicle Types (for Transfer Bookings)

shuttle, private_car, taxi, taxi_boat, local_flight, public_bus, bus_company, train, helicopter, private_plane, private_jet, other
