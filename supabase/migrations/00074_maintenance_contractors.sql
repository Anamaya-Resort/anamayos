-- ============================================================
-- 00074: Maintenance contractors (outside technicians we call:
-- AC, appliances, pumps, card machine, bank). They are people with
-- the "maintenance_contractor" role; they don't log in.
-- Details live on vendor_details (one row per person_role).
-- ============================================================

BEGIN;

INSERT INTO roles (slug, name, description, category, access_level, sort_order)
VALUES ('maintenance_contractor', 'Maintenance Contractor', 'Outside technician or service contact we call for repairs (does not log in)', 'vendor', 1, 28)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE vendor_details
  ADD COLUMN IF NOT EXISTS trades              TEXT[] NOT NULL DEFAULT '{}', -- e.g. air_conditioning, appliances, pumps, card_machine, banking
  ADD COLUMN IF NOT EXISTS services            TEXT,          -- what they do, in plain words
  ADD COLUMN IF NOT EXISTS service_area        TEXT,          -- where they live / work from
  ADD COLUMN IF NOT EXISTS call_order          INT,           -- 1 = call first for this trade, 2 = backup...
  ADD COLUMN IF NOT EXISTS when_to_call        TEXT,
  ADD COLUMN IF NOT EXISTS hourly_rate         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS call_out_fee        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rate_currency       TEXT DEFAULT 'CRC',
  ADD COLUMN IF NOT EXISTS rate_notes          TEXT,          -- "₡25,000 per AC recharge", "parts extra"...
  ADD COLUMN IF NOT EXISTS payment_method      TEXT,          -- SINPE, cash, invoice
  ADD COLUMN IF NOT EXISTS issues_invoice      BOOLEAN,       -- factura electrónica
  ADD COLUMN IF NOT EXISTS last_job_at         DATE;

CREATE INDEX IF NOT EXISTS idx_vendor_details_trades ON vendor_details USING GIN (trades);

CREATE TEMP TABLE _c (email TEXT, name TEXT, phone TEXT, city TEXT, business TEXT, trades TEXT[], services TEXT, area TEXT, call_order INT, when_to_call TEXT) ON COMMIT DROP;
INSERT INTO _c VALUES
('walter.leon@placeholder.local', 'Walter León', '+506 8829 2453', 'Delicias', NULL, '{air_conditioning,appliances,pumps}',
 'Air conditioning technician: repairs and recharges AC. Also repairs refrigerators, washers, dryers and all types of pumps.', 'Lives in Delicias.', 1,
 'First call for AC, appliances and pumps.'),
('fabian.arguijo@placeholder.local', 'Fabián Arguijo', '+506 6187 9546', 'Paquera', 'Soluciones Arguijo', '{air_conditioning}',
 'Air conditioning technician: repairs and recharges AC.', 'Lives in Paquera.', 2,
 'When Walter can''t come or doesn''t answer. Ask if he is in the area and can come.'),
('neyfren@placeholder.local', 'Neyfren', '+506 8361 6507', NULL, NULL, '{air_conditioning}',
 'Air conditioning technician.', NULL, 3,
 'Third option, if Walter and Fabián don''t answer or can''t come.'),
('joel.bac@placeholder.local', 'Joel', '+506 8352 6154', 'San José', 'BAC San José', '{card_machine}',
 'BAC technician: repairs the card machine (datáfono).', 'BAC San José.', 1,
 'When the card machine is broken.'),
('nil.ruiz@placeholder.local', 'Nil Ruiz', '+506 8640 6452', 'San José', 'BAC San José', '{card_machine,banking}',
 'BAC adviser: card machine paper rolls, questions about cards, and BAC services for employees and the hotel.', 'BAC San José.', 1,
 'For card machine paper rolls and BAC account or card questions.');

INSERT INTO persons (email, full_name, phone, whatsapp_number, city, country, preferred_language, access_level, notes)
SELECT email, name, phone, phone, city, 'CR', 'es', 1, 'Maintenance contractor (from reception sheet). Placeholder email; does not log in.'
FROM _c ON CONFLICT (email) DO NOTHING;

INSERT INTO person_roles (person_id, role_id, status, employment_type)
SELECT p.id, r.id, 'active', 'contract'
FROM _c JOIN persons p ON p.email = _c.email CROSS JOIN roles r
WHERE r.slug = 'maintenance_contractor'
  AND NOT EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = p.id AND x.role_id = r.id);

INSERT INTO vendor_details (person_role_id, business_name, vendor_type, trades, services, service_area, call_order, when_to_call)
SELECT pr.id, _c.business, 'services', _c.trades, _c.services, _c.area, _c.call_order, _c.when_to_call
FROM _c JOIN persons p ON p.email = _c.email
JOIN person_roles pr ON pr.person_id = p.id
JOIN roles r ON r.id = pr.role_id AND r.slug = 'maintenance_contractor'
ON CONFLICT (person_role_id) DO NOTHING;

COMMIT;
