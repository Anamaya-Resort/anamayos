-- ============================================================
-- 00076: Geoff confirmed (2026-Nov-28): the private surf lesson is the
-- higher anamaya.com/alacarte price, and there are two different
-- bioluminescence trips. Prices are before the 13% IVA.
-- ============================================================

BEGIN;

UPDATE product_variants v SET price = 120,
  net_price = NULL
FROM products p WHERE p.id = v.product_id AND p.slug = 'surf-lesson-playa-grande' AND v.slug = 'private';

INSERT INTO product_variants (product_id, slug, name, price, min_participants, max_participants, sort_order)
SELECT p.id, 'private-two', 'Private for 2 (total)', 180, 2, 2, 3
FROM products p WHERE p.slug = 'surf-lesson-playa-grande'
ON CONFLICT ON CONSTRAINT unique_variant_slug DO NOTHING;

UPDATE products SET internal_notes = concat_ws(' ', internal_notes,
  'Private $120 and private for 2 $180 confirmed by Geoff 2026-Nov-28 (anamaya.com/alacarte). Supplier sheet and site said $100; check what we pay them.')
WHERE slug = 'surf-lesson-playa-grande' AND coalesce(internal_notes, '') NOT LIKE '%confirmed by Geoff 2026-Nov-28%';

INSERT INTO products (slug, product_type, name, description, base_price, price_unit, price_on_request, duration_minutes,
  schedule, meeting_point, price_notes, internal_notes, sort_order, is_active)
VALUES ('bioluminescence-evening-boat', 'activity', 'Bioluminescence Boat Trip (evening)',
  'See the bioluminescent plankton from a boat. Visible all year; best on dark nights, depending on the moon.',
  87, 'person', false, 270, 'Leaves Anamaya 4:00 PM, back 8:30 PM', 'Leaves from Anamaya.',
  'Price can change with the time of year and transport.',
  'A different trip from Zuma''s sunset + bioluminescence tour (Geoff, 2026-Nov-28). Operator not named on anamaya.com/alacarte: record who runs it.',
  125, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_category_map (product_id, category_id, is_primary)
SELECT p.id, c.id, true FROM products p, product_categories c
WHERE p.slug = 'bioluminescence-evening-boat' AND c.slug = 'excursions-water'
ON CONFLICT DO NOTHING;

COMMIT;

SELECT p.slug, p.base_price, v.name, v.price FROM products p LEFT JOIN product_variants v ON v.product_id = p.id
WHERE p.slug IN ('surf-lesson-playa-grande', 'bioluminescence-evening-boat') ORDER BY p.slug, v.sort_order;
