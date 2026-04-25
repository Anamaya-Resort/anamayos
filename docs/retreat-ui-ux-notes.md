# Retreat UI/UX Build Notes
*Companion to retreat-schema-plan.md — captures specific UI/UX mentions from the user's requirements. This is NOT a complete design spec — it's a reference for what was specifically requested so nothing is forgotten during the build phase.*

---

## 1. Retreat Leader Portal

The retreat leader (access_level 3, role `retreat_leader`) gets their own portal experience within AnamayOS. This is NOT a separate app — it's the same dashboard with role-scoped views.

### What they control:
- **Retreat presentation:** title, tagline, short description, long description, welcome message
- **Application form:** enable/disable, customize questions, review/approve/decline applicants
- **Intake form:** enable/disable, customize questions, view responses
- **Their guest list:** leads, booked, financials — same layout as the current bookings page (`/dashboard/bookings`) but filtered to ONLY their retreats
- **Travel arrangements:** a Travel page (not yet built) showing how their guests are arriving, filtered to ONLY their guests
- **Reviews:** see all reviews for their retreats, respond to reviews, flag reviews as "featured"

### Multiple retreats:
- Some leaders run multiple retreats or even overlapping ones (e.g., YTT + general retreat simultaneously)
- At the top of their portal, show **small cards for each of their upcoming retreats** — clicking one scopes the rest of the dashboard to that retreat
- Cards should show: retreat name, dates, status (draft/confirmed), enrolled/capacity, a progress indicator

### What they CANNOT do:
- See or edit other leaders' retreats
- Access admin settings, billing, system config
- See guest financial details unless explicitly granted (default: no)
- See signed legal documents (privacy — only admin sees those)

---

## 2. Guest Cohort View

Guests who have booked a retreat (deposit_paid or better) can see limited info about fellow participants.

### What guests see:
- Names (only if the other guest opted in via `share_name_in_cohort`)
- Travel times (arrival/departure dates, times, flights — only if opted in via `share_travel_in_cohort`)
- Room/cabin (only if opted in via `share_room_in_cohort`)
- Group chat links (WhatsApp/Telegram) for their retreat

### What guests do NOT see:
- Financials (how much anyone paid, discounts, payment status)
- Medical info, dietary details, intake form answers
- Private notes about them or anyone else
- Other guests' email, phone, or contact details (they can connect via the group chat)

---

## 3. Bookings Page — Retreat Leader View

The existing bookings page at `/dashboard/bookings` should have a variant for retreat leaders:
- Same table/grid layout
- Filtered to ONLY bookings for retreats where this person is in `retreat_teachers`
- Financial columns hidden by default (can be enabled by admin grant if needed)
- Add columns: application status, intake form status, travel info completeness

---

## 4. Travel Arrangements Page

A new page (not yet built) that functions like the bookings page but focuses on travel logistics:
- Shows all guests' arrival and departure info in a timeline or calendar view
- Transfer bookings with vehicle type, confirmation, driver info
- A "coordination" view grouped by date/time so staff can batch transfers
- Retreat leaders see ONLY their own guests' travel
- Team/admin see all
- Guests can see cohort travel (opted-in only) via a simplified view
- Group chat links (WhatsApp, Telegram, etc.) displayed prominently

---

## 5. Application & Intake Form Builder

The form system for retreat leaders:
- When a leader enables an application or intake form for their retreat, it's **pre-seeded from a template** (general template, YTT template, etc. based on retreat type)
- The leader sees the seeded questions and can:
  - **Reorder** (drag-and-drop)
  - **Edit** question text, help text, options, required flag
  - **Delete** questions they don't want
  - **Add** new custom questions
- **Opt-in/out toggle** at the top: "Require application before booking" / "Collect intake info after booking"
- Both can be enabled simultaneously (application pre-booking + intake post-booking)
- Application responses have a review workflow: submitted → under_review → approved/declined/info_requested
- When an application is approved, the booking flow opens for that guest

---

## 6. Itinerary Builder

The itinerary field (`retreats.itinerary`) is structured JSONB, but the UI for retreat leaders should include:
- A form to enter day-by-day schedule: day number/date, time, title, short description, long description
- An **Agent Helper tool** where the leader can:
  - Paste their rough notes (unstructured text) and have AI organize it into the itinerary structure
  - Upload a scan/photo of hand-written notes and have AI OCR + organize it
- The AI populates the structured itinerary which the leader can then edit

---

## 7. Website & SEO Section

Each retreat in AnamayOS has a "Website & SEO" section (within the retreat edit page, not a separate page) with:
- `website_slug` — editable URL slug
- `meta_title` — SEO page title
- `meta_description` — SEO description with character counter (aim ~155 chars)
- `structured_data` — JSON-LD editor (code view) with a button to "Generate from retreat data" using AI
- Preview of how the retreat will appear in Google search results (SERP preview snippet)

---

## 8. Review Display

Reviews have both **resort response** and **retreat leader response** — these display as threaded replies beneath the review on the website.

Reviews marked `is_featured = true` by either the retreat leader or admin automatically appear on:
- That retreat leader's future retreat pages (as social proof from past retreats)
- The resort's general reviews/testimonials section

---

## 9. Promo Code & Discount UI

- Admin creates promo codes in Settings
- During booking, guests can enter a promo code
- System validates: active, not expired, not over max_uses, meets min_booking_amount
- System checks `is_stackable` — if the guest already has a discount (e.g., repeat guest), stackable codes can be combined; non-stackable codes replace or are rejected
- Multiple discount sources can appear on a booking: promo code + repeat guest tier + ambassador, etc.
- Each applied discount is a row in `booking_discounts` with its source, type, and amount

---

## 10. Waiver / Document Signing Flow

1. Guest sees the waiver/document in the UI (rendered from a template)
2. Guest reads and either checks a box or draws a signature
3. System assembles a **visual PDF snapshot**: document text + signature + timestamp + IP + guest name
4. PDF is uploaded to Supabase Storage: `waivers/{person_id}/{retreat_id}/{doc_id}.pdf`
5. SHA-256 hash is computed and stored
6. (Optional/future) Hash submitted to blockchain timestamping service
7. The `signed_documents` record captures all provenance metadata
8. If the waiver version changes, old signatures are marked `is_current = false` and the guest is prompted to re-sign

---

## 11. Communication Log UI

- Displayed as a unified timeline on the guest's profile page in AnamayOS
- Shows all channels interleaved chronologically: email, WhatsApp, Telegram, phone, in-person
- Color-coded or icon-coded by channel
- **Manual entry button**: team member clicks "Log Communication" → form with: channel (dropdown), direction (in/out), subject, body, date/time
- Pre-fills "Phone Call" template with date, time, and a summary text area
- Bot-captured messages (WhatsApp, Telegram) appear automatically with source attribution

---

## 12. Guest Notes UI

- Notes appear on the guest's profile page in a separate "Internal Notes" tab
- Each note shows: author, date, note type badge, retreat context (if any), body text
- Flagged notes appear with a visual indicator (e.g., yellow background or pin icon)
- Visibility label shows who can see this note: "Team", "Retreat Leaders", "Admin Only"
- Retreat leaders see notes where `visible_to` includes `retreat_leader` AND the guest is on one of their retreats
- Guests NEVER see this tab — it doesn't render for guest-role users

---

## 13. Featured Retreats

`is_featured` on retreats is set by team/admin (not retreat leaders). Featured retreats:
- Appear at the top of the retreat listing on the website
- Have a visual distinction (colored border, badge, or position)
- Can be toggled on/off from the retreat list view in AnamayOS without opening the full editor

---

## 14. Dynamic+ Pricing Display

For retreats using the bonding curve pricing model (`pricing_model = 'dynamic_plus'`):
- Show a visual price chart/curve on the website: start price → current price → end price
- Display "Current Price: $X" prominently
- Show "X spots remaining" to reinforce urgency
- Price updates automatically as bookings increase (computed, not stored)
- The retreat leader sets: start price, end price (when full), and max capacity
