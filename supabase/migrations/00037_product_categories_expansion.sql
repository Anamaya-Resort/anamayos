-- ============================================================
-- 00035: Expand product categories to full 16-category set
-- Adds missing top-level categories + new sub-categories
-- ============================================================

-- New top-level categories (skip existing: spa, yoga, longevity, excursions, activities, accommodation, transfers, packages, gifts)
INSERT INTO product_categories (slug, name, description, sort_order) VALUES
  ('classes',         'Classes & Workshops',    'Cooking, dance, art, music, and herbal workshops', 5),
  ('certifications',  'Certifications & Courses', 'Multi-session programs with credentials (PADI, freediving, etc.)', 6),
  ('meal-plans',      'Meal Plans',             'Standard, vegan, high protein, and keto daily meal options', 7),
  ('cookbook',         'Cookbook',               'Digital cookbook membership with recipes and videos', 8),
  ('food-beverage',   'Food & Beverage',        'Ceremonies, private chef, smoothies, and bar', 9),
  ('photography',     'Photography & Media',    'Photo sessions, drone, and social media content', 10),
  ('retail',          'Gift Shop & Retail',     'Apparel, yoga props, crystals, skincare, and books', 11),
  ('events',          'Events & Ceremonies',    'Sound baths, fire ceremonies, weddings, and venue rental', 14),
  ('rental',          'Rental',                 'Surfboards, paddleboards, snorkel gear, bikes, GoPros', 15)
ON CONFLICT (slug) DO NOTHING;

-- Rename 'activities' to 'classes' (update existing if it exists)
UPDATE product_categories SET name = 'Classes & Workshops', description = 'Cooking, dance, art, music, and herbal workshops' WHERE slug = 'activities';

-- Remove accommodation from products (mark inactive)
UPDATE product_categories SET is_active = false WHERE slug = 'accommodation';

-- Update sort orders for existing categories
UPDATE product_categories SET sort_order = 1 WHERE slug = 'spa';
UPDATE product_categories SET sort_order = 2 WHERE slug = 'yoga';
UPDATE product_categories SET sort_order = 3 WHERE slug = 'longevity';
UPDATE product_categories SET sort_order = 4 WHERE slug = 'excursions';
UPDATE product_categories SET sort_order = 12 WHERE slug = 'gifts';
UPDATE product_categories SET sort_order = 13 WHERE slug = 'transfers';
UPDATE product_categories SET sort_order = 16 WHERE slug = 'packages';

-- New sub-categories for classes
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'classes'), 'classes-cooking', 'Cooking Class', 'Learn to cook local cuisine', 1),
  ((SELECT id FROM product_categories WHERE slug = 'classes'), 'classes-dance', 'Salsa/Dance Class', 'Dance lessons', 2),
  ((SELECT id FROM product_categories WHERE slug = 'classes'), 'classes-art', 'Art & Craft Workshop', 'Painting, crafts, and creative workshops', 3),
  ((SELECT id FROM product_categories WHERE slug = 'classes'), 'classes-music', 'Music/Drumming Circle', 'Community rhythm sessions', 4),
  ((SELECT id FROM product_categories WHERE slug = 'classes'), 'classes-herbal', 'Herbal Medicine', 'Medicinal plant workshops', 5)
ON CONFLICT (slug) DO NOTHING;

-- Sub-categories for meal plans
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'meal-plans'), 'meal-standard', 'Standard', 'Balanced daily meals', 1),
  ((SELECT id FROM product_categories WHERE slug = 'meal-plans'), 'meal-vegan', 'Vegan', 'Fully plant-based meals', 2),
  ((SELECT id FROM product_categories WHERE slug = 'meal-plans'), 'meal-high-protein', 'High Protein', 'Protein-focused meals', 3),
  ((SELECT id FROM product_categories WHERE slug = 'meal-plans'), 'meal-keto', 'Keto', 'Low-carb high-fat meals', 4)
ON CONFLICT (slug) DO NOTHING;

-- Sub-categories for food & beverage
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'food-beverage'), 'fb-cacao', 'Cacao Ceremony', 'Sacred cacao rituals', 1),
  ((SELECT id FROM product_categories WHERE slug = 'food-beverage'), 'fb-chef', 'Private Chef Experience', 'Custom private dining', 2),
  ((SELECT id FROM product_categories WHERE slug = 'food-beverage'), 'fb-bar', 'Bar & Drinks', 'Smoothies and beverages', 3)
ON CONFLICT (slug) DO NOTHING;

-- Sub-categories for events
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'events'), 'events-sound', 'Sound Bath', 'Crystal bowl sound healing', 1),
  ((SELECT id FROM product_categories WHERE slug = 'events'), 'events-fire', 'Fire Ceremony', 'Sacred fire circles', 2),
  ((SELECT id FROM product_categories WHERE slug = 'events'), 'events-wedding', 'Wedding/Vow Renewal', 'Intimate ceremonies', 3),
  ((SELECT id FROM product_categories WHERE slug = 'events'), 'events-rental', 'Private Event Rental', 'Venue hire', 4)
ON CONFLICT (slug) DO NOTHING;

-- Sub-categories for rental
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'rental'), 'rental-surf', 'Surf Board', 'Surfboard rental', 1),
  ((SELECT id FROM product_categories WHERE slug = 'rental'), 'rental-sup', 'Paddle Board', 'SUP rental', 2),
  ((SELECT id FROM product_categories WHERE slug = 'rental'), 'rental-snorkel', 'Snorkel Gear', 'Mask and fins rental', 3),
  ((SELECT id FROM product_categories WHERE slug = 'rental'), 'rental-bike', 'Bicycle', 'Beach cruiser rental', 4),
  ((SELECT id FROM product_categories WHERE slug = 'rental'), 'rental-camera', 'Camera/GoPro', 'Action camera rental', 5)
ON CONFLICT (slug) DO NOTHING;

-- Add spa sub-categories that are missing
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'spa'), 'spa-holistic', 'Holistic Therapies', 'Lymphatic, craniosacral, reflexology', 6),
  ((SELECT id FROM product_categories WHERE slug = 'spa'), 'spa-addon', 'Add-On', '15-minute add-on treatments', 7)
ON CONFLICT (slug) DO NOTHING;

-- Add beach sub-category to excursions
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-beach', 'Beach', 'Beach excursions', 5),
  ((SELECT id FROM product_categories WHERE slug = 'excursions'), 'excursions-horse', 'Horseback Riding', 'Horseback riding tours', 6)
ON CONFLICT (slug) DO NOTHING;

-- Longevity: add infrared sauna sub-category
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'longevity'), 'longevity-sauna', 'Infrared Sauna', 'Far infrared sauna sessions', 6)
ON CONFLICT (slug) DO NOTHING;

-- Transfers: add sub-categories
INSERT INTO product_categories (parent_id, slug, name, description, sort_order) VALUES
  ((SELECT id FROM product_categories WHERE slug = 'transfers'), 'transfers-shuttle', 'Airport Shuttle', 'Shared airport transfers', 1),
  ((SELECT id FROM product_categories WHERE slug = 'transfers'), 'transfers-private', 'Private Car', 'Private door-to-door transfers', 2),
  ((SELECT id FROM product_categories WHERE slug = 'transfers'), 'transfers-boat', 'Taxi Boat', 'Fast boat crossings', 3),
  ((SELECT id FROM product_categories WHERE slug = 'transfers'), 'transfers-flight', 'Local Flight', 'Domestic scenic flights', 4)
ON CONFLICT (slug) DO NOTHING;
