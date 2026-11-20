# Reception Desk + Spa day sheet

Module: `src/modules/desk/` (settings in `config.ts`: spa hours 08:00-20:30,
15-min slots, 30-min gap between sessions per room/therapist, tip presets).

## Screens
- **Experience > Reception Desk** (`/dashboard/experience/desk`): guest list
  (staying now + arriving within 60 days), tiles Spa / Excursions / Gift Shop
  / Snacks & Bar, guest folio with cancel. Phone = one step at a time; lg+ =
  guest list on the left.
- **Experience > Spa** (`/dashboard/experience/spa`): digital version of the
  paper "Spa Services Bookings" sheet. Rooms across (facilities of type
  spa_room), 15-min rows, therapist hours (staff_availability, per day, split
  shifts allowed) as lanes + "On duty" chips, day note (spa_day_notes). Tap an
  empty spot to book; tap a booking to see/cancel it.

## Data
- Charges are `booking_line_items` (booking_id NOT NULL, so walk-in guests
  need a booking first). Spa add-ons are child lines (parent_line_item_id).
- Price = price on the TREATMENT date (`service_price_changes`, see
  spa-pricing.md). IVA 13% from `tax_rates` per line; tips in `tip_amount`
  (untaxed); practitioner payout snapshot in `commission_amount`.
- Any active practitioner can be booked for any treatment; the treatment's
  `service_providers` show first with a green dot.

API: `/api/desk/{guests,catalog,charges,day}` (staff, access level 3+).
Migrations 00070 (folio completion) and 00071 (rooms, day notes, therapists).
