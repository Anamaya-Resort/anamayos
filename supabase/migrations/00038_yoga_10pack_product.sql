-- ============================================================
-- 00038: Create 10-Pack Yoga Classes product
-- Default retreat add-on alongside High Protein and Keto meal plans
-- ============================================================

INSERT INTO products (product_type, slug, name, short_description, description, base_price, currency, is_addon, is_active, sort_order)
VALUES ('service', 'yoga-10-pack', '10-Pack Yoga Classes', 'Ten drop-in yoga classes to use during your stay', 'A flexible pack of 10 yoga classes you can attend at any time during your retreat. Includes vinyasa, yin, meditation, and breathwork sessions. Use them at your own pace.', 150.00, 'USD', true, true, 1)
ON CONFLICT (slug) DO NOTHING;

-- Link to yoga category
INSERT INTO product_category_map (product_id, category_id, is_primary, sort_order)
SELECT p.id, c.id, true, 0
FROM products p, product_categories c
WHERE p.slug = 'yoga-10-pack' AND c.slug = 'yoga'
ON CONFLICT (product_id, category_id) DO NOTHING;
