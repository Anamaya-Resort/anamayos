-- ============================================================
-- 00075: Paid extras from anamaya.com/alacarte that weren't in the
-- catalog yet, plus price updates confirmed by Geoff (2026-Nov-28).
-- Prices are before the 13% IVA (added at checkout), as the page says.
-- ============================================================

BEGIN;

-- Tortuga Island: Geoff confirmed $90 + tax (the website's $87 is old).
UPDATE products SET internal_notes = 'Needs at least 8 people to run. $90 + tax confirmed by Geoff 2026-Nov-28 (anamaya.com/alacarte still shows $87).'
WHERE slug = 'zuma-tortuga-snorkel-bbq';

-- Scuba certification: the a la carte page also sells it at $1,200 for two.
UPDATE products SET
  includes = 'CMAS International diving licence: 5 pool classes, 3-4 beach dives and 1 deep ocean dive by boat. Instructor, equipment, lunch and refreshments; transport if needed.',
  internal_notes = 'anamaya.com/alacarte names the provider "Isla Tortuga Dive Club"; the reception sheet says Montezuma Crew. Confirm they are the same. Montezuma Crew''s own site sells the CMAS 1-star course at $650.'
WHERE slug = 'crew-dive-course';

INSERT INTO product_variants (product_id, slug, name, price, net_price, min_participants, max_participants, sort_order)
SELECT p.id, v.slug, v.name, v.price, v.net, v.min_p, v.max_p, v.sort
FROM (VALUES
  ('crew-dive-course', 'one',  '1 person',               700, 630, 1, 1, 1),
  ('crew-dive-course', 'two',  '2 people (total)',      1200, NULL, 2, 2, 2)
) AS v(product, slug, name, price, net, min_p, max_p, sort)
JOIN products p ON p.slug = v.product
ON CONFLICT ON CONSTRAINT unique_variant_slug DO NOTHING;

-- New items. supplier_id is empty where Anamaya runs it or the operator
-- isn't known yet (see internal_notes).
CREATE TEMP TABLE _n (
  slug TEXT, cat TEXT, ptype product_type, name TEXT, description TEXT, base NUMERIC, unit TEXT, on_request BOOLEAN,
  minutes INT, min_p INT, schedule TEXT, includes TEXT, meet TEXT, price_notes TEXT, internal TEXT, sort INT
) ON COMMIT DROP;

INSERT INTO _n VALUES
('yoga-drop-in', 'yoga', 'service', 'Yoga Class (drop-in)',
 $t$Join an Anamaya class: 1.5-hour Vinyasa Flow six mornings a week, or 1-hour Yin, Restorative or Slow Flow four afternoons a week.$t$,
 18, 'person', false, 90, NULL, 'Vinyasa Flow 6 mornings a week (1.5 h); Yin / Restorative / Slow Flow 4 afternoons a week (1 h)', NULL, 'Anamaya yoga deck.',
 NULL, 'For guests of Anamaya''s own retreats. Private retreat leaders not teaching their group can be connected with local teachers.', 200),

('yoga-private', 'yoga-private', 'service', 'Private Yoga Session',
 $t$A one-on-one yoga lesson.$t$,
 NULL, 'person', true, NULL, NULL, NULL, NULL, NULL,
 'Price and availability depend on the teacher.', NULL, 210),

('salsa-class', 'classes-dance', 'activity', 'Salsa Class',
 $t$A one-hour salsa lesson overlooking the ocean.$t$,
 18, 'person', false, 60, 4, 'Not always available', NULL, 'Anamaya.',
 NULL, 'Instructor not named on the website.', 220),

('spanish-class', 'classes', 'activity', 'Spanish Class',
 $t$A basic beginner Spanish lesson.$t$,
 NULL, 'person', true, NULL, 4, NULL, NULL, 'Anamaya.',
 'Prices vary by instructor.', 'Instructor not named on the website.', 230),

('surfboard-rental', 'rental-surf', 'rental', 'Surfboard Rental',
 $t$Surfboard rental for experienced surfers.$t$,
 30, 'item', false, NULL, NULL, NULL, NULL, NULL,
 NULL, 'Who supplies the boards isn''t on the website.', 240),

('surf-transport', 'transfers-private', 'transfer', 'Surf Transport',
 $t$Transport to the surf break, for guests renting a board.$t$,
 20, 'person', false, NULL, NULL, NULL, NULL, 'Pickup at Anamaya.',
 NULL, 'Sold with the surfboard rental on anamaya.com/alacarte.', 245),

('santa-teresa-sunset-beach-trip', 'excursions-beach', 'activity', 'Sunset Beach Trip to Santa Teresa',
 $t$An afternoon at the beach in Santa Teresa, staying for the sunset.$t$,
 30, 'person', false, 300, NULL, 'Wednesdays, leaves 1:00 PM, back 6:00 PM', 'Transport.', 'Leaves from Anamaya.',
 NULL, 'Anamaya''s own weekly trip. Transport provider not recorded.', 250),

('horseback-riding', 'excursions-horse', 'activity', 'Horseback Riding',
 $t$A couple of different rides, depending on the season and availability.$t$,
 NULL, 'person', true, NULL, NULL, NULL, NULL, NULL,
 'Ask reception.', 'Supplier to confirm: Montezuma Tour is not listed (booking office). Find who owns the horses and book them directly.', 260),

('butterfly-garden', 'excursions-nature', 'activity', 'Butterfly Garden',
 $t$Visit the butterfly garden next door, just down the hill from Anamaya.$t$,
 NULL, 'person', true, NULL, NULL, NULL, NULL, 'Next door, down the hill from Anamaya.',
 'Ask reception for availability and pricing.', 'Supplier not recorded yet.', 270),

('circus-performance', 'events', 'service', 'Circus Performance & Dance Party',
 $t$Local talent and Anamaya staff put on a circus performance and dance party, usually as the end-of-retreat celebration.$t$,
 NULL, 'group', true, NULL, NULL, NULL, NULL, 'Anamaya.',
 'Private retreat leaders: ask the Retreat Coordinator.', 'Included in Anamaya''s own retreats.', 280);

INSERT INTO products (slug, product_type, name, description, base_price, price_unit, price_on_request, duration_minutes,
  min_participants, max_participants, schedule, includes, meeting_point, price_notes, internal_notes, sort_order, is_active)
SELECT slug, ptype, name, description, base, unit, on_request, minutes, min_p, NULL, schedule, includes, meet, price_notes, internal, sort, true
FROM _n ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_category_map (product_id, category_id, is_primary)
SELECT p.id, c.id, true FROM _n JOIN products p ON p.slug = _n.slug JOIN product_categories c ON c.slug = _n.cat
ON CONFLICT DO NOTHING;

COMMIT;
