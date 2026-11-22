# Suppliers: excursions and transport

Companies and drivers we book directly for guests. Loaded from the reception sheet
"Excursions and Providers.xlsx" and checked against each supplier's own website on
2026-Nov-21 (migrations 00072 and 00073).

## Rule: direct suppliers only
We work with each operator directly. A company that mostly resells other operators'
tours (a middleman) is kept in `suppliers` with `is_active = false` and the reason in
`verification_notes`, so nobody adds it again by accident. Today that is Montezuma Tour
(booking office) and Santa Teresa Adventure (could not be verified, website parked).

## Where things live
- `suppliers`: one row per company or driver. `kinds` says excursions, transport or both.
  Contacts, how to book, reception notes (`booking_notes`), cancellation policy, other
  policies (`policies`: luggage, children, pets, wait time), and what we found when we
  checked their website (`verified_at`, `verification_notes`).
- `products` (excursions and transfers): `supplier_id`, `net_price` (what we pay),
  `base_price` (guest price before 13% IVA), `price_unit` (person, boat, vehicle),
  `price_on_request`, `price_notes`, `min_participants`, `max_participants`, `min_age`,
  `schedule`, `season`, `includes`, `what_to_bring`, `meeting_point`,
  `cancellation_policy`, `internal_notes` (staff only).
- `product_variants`: price options (group vs private, 2 vs 4+ people, routes), each with
  its own price and optional `net_price`.

## Reception Desk
- Excursions tile: products under the `excursions` category.
- Transport tile: products under `transfers` (shuttles, private transfers, taxi boat, taxis).
- A product with price options shows one row per option.
- "Price on request" items (taxis, private charters) don't show on the desk, so nothing
  is charged at $0. They are booked with the supplier and charged once a price is agreed.

## Maintenance contractors
Outside technicians and service contacts (AC, appliances, pumps, card machine, bank).
They are people (`persons`) with the `maintenance_contractor` role and don't log in
(placeholder emails). Their details are on `vendor_details` for that role:
`trades`, `services`, `service_area`, `call_order` (1 = call first for that trade),
`when_to_call`, `hourly_rate`, `call_out_fee`, `rate_currency` (default colones),
`rate_notes`, `payment_method`, `issues_invoice` (factura electrónica), `last_job_at`.
Loaded from the reception sheet in migration 00074. No prices yet.
