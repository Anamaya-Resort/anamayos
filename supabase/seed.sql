-- AO Platform: Seed data
-- Populated from anamaya.com room data and provided spa menu.
-- This data is config-driven — update via the admin UI or re-seed.

-- ============================================================
-- ROOM CATEGORIES
-- ============================================================
INSERT INTO room_categories (slug, name, description, sort_order) VALUES
  ('shared', 'Shared Rooms', 'Shared accommodation with per-bed pricing', 1),
  ('standard', 'Standard Private', 'Private rooms with standard amenities', 2),
  ('premium', 'Premium Private', 'Upgraded private rooms and cabinas', 3),
  ('luxury', 'Luxury Suites', 'Top-tier suites and towers', 4);

-- ============================================================
-- ROOMS (from anamaya.com retreat pricing)
-- ============================================================
-- Shared rooms (~$185/night based on $1,295/week)
INSERT INTO rooms (category_id, name, slug, description, max_occupancy, is_shared, base_rate_per_night, sort_order) VALUES
  ((SELECT id FROM room_categories WHERE slug = 'shared'), 'Casita', 'casita', 'Shared casita accommodation, priced per bed. Cozy and social.', 4, true, 185.00, 1),
  ((SELECT id FROM room_categories WHERE slug = 'shared'), 'Gaia Cabina', 'gaia-cabina', 'Shared cabina accommodation, priced per bed. Surrounded by nature.', 4, true, 185.00, 2);

-- Standard private rooms (~$342/night based on $2,395/week)
INSERT INTO rooms (category_id, name, slug, description, max_occupancy, is_shared, base_rate_per_night, sort_order) VALUES
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Ganesh Room', 'ganesh-room', 'Private room with standard amenities.', 2, false, 342.00, 1),
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Mantra Room', 'mantra-room', 'Private room with peaceful atmosphere.', 2, false, 342.00, 2),
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Prana Cabina', 'prana-cabina', 'Private cabina nestled in tropical gardens.', 2, false, 342.00, 3),
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Shiva Room', 'shiva-room', 'Private room with mountain views.', 2, false, 342.00, 4),
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Bali Cabina', 'bali-cabina', 'Bali-inspired private cabina.', 2, false, 342.00, 5),
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Jungle Cabina', 'jungle-cabina', 'Private cabina immersed in jungle setting.', 2, false, 342.00, 6),
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Lotus Cabina', 'lotus-cabina', 'Serene private cabina.', 2, false, 342.00, 7),
  ((SELECT id FROM room_categories WHERE slug = 'standard'), 'Dharma Room', 'dharma-room', 'Tranquil private room.', 2, false, 342.00, 8);

-- Premium / luxury rooms (~$513/night based on $3,590/week)
INSERT INTO rooms (category_id, name, slug, description, max_occupancy, is_shared, base_rate_per_night, sort_order) VALUES
  ((SELECT id FROM room_categories WHERE slug = 'luxury'), 'Garuda Tower', 'garuda-tower', 'Spacious tower suite with panoramic ocean views.', 2, false, 513.00, 1),
  ((SELECT id FROM room_categories WHERE slug = 'luxury'), 'Anahata Room', 'anahata-room', 'Premium room with expansive living space.', 2, false, 513.00, 2),
  ((SELECT id FROM room_categories WHERE slug = 'luxury'), 'Ananda Cabina', 'ananda-cabina', 'Premium cabina with luxury finishes.', 2, false, 513.00, 3),
  ((SELECT id FROM room_categories WHERE slug = 'luxury'), 'Hanuman Room', 'hanuman-room', 'Top-tier private suite.', 2, false, 513.00, 4);

-- ============================================================
-- SPA CATEGORIES
-- ============================================================
INSERT INTO spa_categories (slug, name, description, sort_order) VALUES
  ('massage', 'Massage Therapies', 'Full body massage treatments', 1),
  ('bodywork', 'Bodywork & Energy', 'Specialized bodywork, energy healing, and cranial therapies', 2),
  ('skin', 'Skin & Body Treatments', 'Facials, body polishes, and wraps', 3),
  ('specials', 'Spa Specials', 'Signature and seasonal treatments', 4),
  ('addons', 'Add-Ons', '15-minute enhancement add-ons to any treatment', 5);

-- ============================================================
-- SPA SERVICES
-- ============================================================

-- Massage category
INSERT INTO spa_services (category_id, slug, name, description, duration_minutes, price, is_addon, contraindications, preparation_notes, sort_order) VALUES
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'relaxing-60', 'Relaxing Massage', 'Rhythmic and mesmerizing, this massage style uses gentle flowing strokes to increase circulation and relieve tension in the body. Warm towels and essential oils are infused into the session aiding the relaxation process and to create a sense of wellbeing.', 60, 80.00, false, NULL, NULL, 1),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'relaxing-75', 'Relaxing Massage', 'Rhythmic and mesmerizing, this massage style uses gentle flowing strokes to increase circulation and relieve tension in the body. Warm towels and essential oils are infused into the session aiding the relaxation process and to create a sense of wellbeing.', 75, 95.00, false, NULL, NULL, 2),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'relaxing-90', 'Relaxing Massage', 'Rhythmic and mesmerizing, this massage style uses gentle flowing strokes to increase circulation and relieve tension in the body. Warm towels and essential oils are infused into the session aiding the relaxation process and to create a sense of wellbeing.', 90, 110.00, false, NULL, NULL, 3),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'therapeutic-60', 'Therapeutic Massage', 'Specific injuries and chronic problem areas are attended to in this treatment. Your therapist applies myofascial release techniques needed for your ailment in varying pressures to relieve pain, improve range of motion and help you get back to your best self. Hot towels and essential oils to calm the mind.', 60, 90.00, false, NULL, NULL, 4),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'therapeutic-75', 'Therapeutic Massage', 'Specific injuries and chronic problem areas are attended to in this treatment. Your therapist applies myofascial release techniques needed for your ailment in varying pressures to relieve pain, improve range of motion and help you get back to your best self. Hot towels and essential oils to calm the mind.', 75, 105.00, false, NULL, NULL, 5),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'therapeutic-90', 'Therapeutic Massage', 'Specific injuries and chronic problem areas are attended to in this treatment. Your therapist applies myofascial release techniques needed for your ailment in varying pressures to relieve pain, improve range of motion and help you get back to your best self. Hot towels and essential oils to calm the mind.', 90, 125.00, false, NULL, NULL, 6),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'deep-tissue-60', 'Deep Tissue Massage', 'This bodywork penetrates into the deepest layers of muscle and connective tissue addressing soreness, pain and muscle damage. Firm pressure is applied with specific myofascial techniques to release tightness in muscle tissue, ligaments and joints. Heated towels and essential oils complement this curative modality.', 60, 90.00, false, NULL, 'It is not uncommon for clients to feel sore for a day or two after. Drinking plenty of water post-massage helps flush toxins and reduce soreness.', 7),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'deep-tissue-75', 'Deep Tissue Massage', 'This bodywork penetrates into the deepest layers of muscle and connective tissue addressing soreness, pain and muscle damage. Firm pressure is applied with specific myofascial techniques to release tightness in muscle tissue, ligaments and joints.', 75, 105.00, false, NULL, NULL, 8),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'deep-tissue-90', 'Deep Tissue Massage', 'This bodywork penetrates into the deepest layers of muscle and connective tissue addressing soreness, pain and muscle damage. Firm pressure is applied with specific myofascial techniques to release tightness in muscle tissue, ligaments and joints.', 90, 125.00, false, NULL, NULL, 9),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'hot-stone-60', 'Hot Stone Massage', 'A relaxing massage where the therapist uses smooth, heated volcanic stones as an extension of their own hands. The heated stones melt away tension and ease sore muscles. This therapy has a lovely sedative effect that can relieve chronic pain, reduce stress and promote deep relaxation.', 60, 100.00, false, NULL, NULL, 10),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'hot-stone-75', 'Hot Stone Massage', 'A relaxing massage where the therapist uses smooth, heated volcanic stones as an extension of their own hands. The heated stones melt away tension and ease sore muscles.', 75, 115.00, false, NULL, NULL, 11),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'hot-stone-90', 'Hot Stone Massage', 'A relaxing massage where the therapist uses smooth, heated volcanic stones as an extension of their own hands. The heated stones melt away tension and ease sore muscles.', 90, 135.00, false, NULL, NULL, 12),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'eastern-60', 'Eastern Massage', 'Head, Face, Neck and Shoulder Release. Blends the art of Japanese facial massage with hypnotic Asian neck and head techniques to relieve stress, balance energy and revitalize facial glow. Lots of hot towels to relax muscles. Especially helpful for headaches, TMJ and stress in the shoulder region.', 60, 90.00, false, NULL, NULL, 13),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'ashiatsu-60', 'Ashiatsu "Barefoot" Massage', 'Ashiatsu is deep tissue massage in which your practitioner uses their feet to perform therapy. Provides a deep tissue experience that is smooth, deep and less pointed. The practitioner uses overhead bars and a bench for support and pressure control. Promotes better posture, relieves painful sore muscles, increases flexibility and promotes circulation.', 60, 100.00, false, NULL, NULL, 14),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'ashiatsu-75', 'Ashiatsu "Barefoot" Massage', 'Ashiatsu is deep tissue massage in which your practitioner uses their feet to perform therapy. Provides a deep tissue experience that is smooth, deep and less pointed.', 75, 115.00, false, NULL, NULL, 15),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'ashiatsu-90', 'Ashiatsu "Barefoot" Massage', 'Ashiatsu is deep tissue massage in which your practitioner uses their feet to perform therapy. Provides a deep tissue experience that is smooth, deep and less pointed.', 90, 135.00, false, NULL, NULL, 16),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'lomi-lomi-60-2h', 'Lomi Lomi Massage (2 Hands)', 'An ancient form of therapeutic massage from the spiritual traditions of native Hawaiians. Rooted in the philosophy of interconnectedness, Lomi Lomi harmonizes body, mind, and spirit using flowing strokes resembling gentle waves of the ocean. Therapists use forearms and elbows in addition to hands.', 60, 90.00, false, NULL, NULL, 17),
  ((SELECT id FROM spa_categories WHERE slug = 'massage'), 'lomi-lomi-60-4h', 'Lomi Lomi Massage (4 Hands)', 'An ancient form of therapeutic massage from native Hawaiian traditions, performed by two therapists simultaneously for a more immersive and transformative experience. Flowing strokes from both practitioners create a deeply harmonizing session.', 60, 130.00, false, NULL, NULL, 18);

-- Bodywork & Energy category
INSERT INTO spa_services (category_id, slug, name, description, duration_minutes, price, is_addon, contraindications, preparation_notes, sort_order) VALUES
  ((SELECT id FROM spa_categories WHERE slug = 'bodywork'), 'chi-nei-tsang-60', 'Chi Nei Tsang (Abdominal Massage)', 'An ancient abdominal massage that detoxifies, energizes and retrains internal organs to work more efficiently. Focuses on the abdominal area and often releases tension in other parts of the body. Helps with digestive disorders and overall tension.', 60, 80.00, false, 'Not suitable for those who have had abdominal surgery in the past year, are currently menstruating using an IUD, pregnant or actively trying to become pregnant.', 'Refrain from eating for 2 hours and drinking for 1 hour before session. Wear comfortable, loose fitting clothing.', 1),
  ((SELECT id FROM spa_categories WHERE slug = 'bodywork'), 'lymphatic-drainage-60', 'Lymphatic Drainage Massage', 'This gentle form of massage uses light, rhythmic strokes and pumping movements in the direction of lymphatic fluid flow. Promotes drainage of stagnant fluids, detoxifies the body, and supports a healthy immune system. Essential to overall health.', 60, 80.00, false, NULL, NULL, 2),
  ((SELECT id FROM spa_categories WHERE slug = 'bodywork'), 'cranio-sacral-60', 'Cranio Sacral Therapy', 'A gentle, non-invasive form of bodywork addressing alignment of bones in the spinal column, head and sacrum. Using light holding technique along the spine, this creates balance in cerebrospinal fluid flow. Provides relief from migraines, neck and back pain, TMJ disorders and more.', 60, 80.00, false, NULL, 'Wear comfortable pants and a shirt.', 3),
  ((SELECT id FROM spa_categories WHERE slug = 'bodywork'), 'foot-reflexology-60', 'Foot Reflexology', 'An ancient healing practice based on the principle that foot reflex zones correspond to body parts. Therapist cleans lower legs and feet with salts, essential oils and hot towels, then applies varying pressure to specific foot regions. Improves circulation, boosts energy, relieves headaches, revitalizes nerve function, and relieves plantar fasciitis.', 60, 80.00, false, NULL, NULL, 4),
  ((SELECT id FROM spa_categories WHERE slug = 'bodywork'), 'reiki-60', 'Reiki Session', 'An energy balancing technique of "laying on of hands." Based on the idea that universal life energy flows through all living beings. Offers a non-intrusive way to balance and harmonize the body''s energy, promoting peace, well-being, and vitality.', 60, 80.00, false, NULL, 'Wear comfortable non-restrictive clothing.', 5),
  ((SELECT id FROM spa_categories WHERE slug = 'bodywork'), 'reiki-75', 'Reiki Session', 'An energy balancing technique of "laying on of hands." Offers a non-intrusive way to balance and harmonize the body''s energy, promoting peace, well-being, and vitality.', 75, 95.00, false, NULL, 'Wear comfortable non-restrictive clothing.', 6),
  ((SELECT id FROM spa_categories WHERE slug = 'bodywork'), 'reiki-90', 'Reiki Session', 'An energy balancing technique of "laying on of hands." Offers a non-intrusive way to balance and harmonize the body''s energy, promoting peace, well-being, and vitality.', 90, 110.00, false, NULL, 'Wear comfortable non-restrictive clothing.', 7);

-- Skin & Body category
INSERT INTO spa_services (category_id, slug, name, description, duration_minutes, price, is_addon, contraindications, preparation_notes, sort_order) VALUES
  ((SELECT id FROM spa_categories WHERE slug = 'skin'), 'facial-60', 'Facial', 'Deep cleansing, moisturizing, and rejuvenating treatment by licensed estheticians. Uses steamed towels and natural, organic products made in Costa Rica. Includes cleanse, exfoliation, facial masks, deep cleansing or aculift massage. Extractions optional. Complimentary neck and scalp massage included.', 60, 80.00, false, NULL, NULL, 1),
  ((SELECT id FROM spa_categories WHERE slug = 'skin'), 'body-polish-60', 'Organic Body Polish', 'Costa Rican sea salts mixed with essential oils gently rubbed on the body to stimulate circulation and exfoliate skin. Concludes with a luxurious aromatic lavender mint body lotion application, leaving the body soft and silky smooth.', 60, 90.00, false, NULL, NULL, 2),
  ((SELECT id FROM spa_categories WHERE slug = 'skin'), 'detox-body-wrap-75', 'Detox Body Wrap', 'Begins with light skin buffing, followed by pure Costa Rican healing blue clay mask applied to whole body, then a gentle cocoon-like wrap to enhance detoxifying. After a warm shower, a refreshing mint and coconut lotion is applied to improve skin quality and reduce inflammation.', 75, 100.00, false, NULL, 'Please wear a bikini.', 3);

-- Spa Specials
INSERT INTO spa_services (category_id, slug, name, description, duration_minutes, price, is_addon, contraindications, preparation_notes, sort_order) VALUES
  ((SELECT id FROM spa_categories WHERE slug = 'specials'), 'bamboo-massage-60', 'Bamboo Massage', 'A lovely full body oil massage with deep, medium or light pressure. Therapist uses smooth bamboo sticks of various sizes to warm and release tension. Bamboo is "the good luck plant." Sticks are rolled across muscles with rhythmic gliding motions. Excellent for those who enjoy deep tissue massage.', 60, 100.00, false, NULL, NULL, 1),
  ((SELECT id FROM spa_categories WHERE slug = 'specials'), 'kobido-60', 'Kobido (Ancient Japanese Facial Massage)', 'A traditional holistic facial treatment combining ancient Japanese techniques with modern facial therapy. Employs deep tissue massage, lymphatic drainage, acupressure, and gentle tapping. Prevents signs of aging by toning facial muscles and rejuvenating skin cells, offering a natural facelift. Balances chi and promotes relaxation.', 60, 90.00, false, NULL, NULL, 2);

-- Add-Ons (15 minutes, $30 each)
INSERT INTO spa_services (category_id, slug, name, description, duration_minutes, price, is_addon, sort_order) VALUES
  ((SELECT id FROM spa_categories WHERE slug = 'addons'), 'addon-back-polish', 'Back Body Polish', 'After cleaning your back with salts scented with essential oils and hot towels, receive a refreshing application of soothing coconut lotion.', 15, 30.00, true, 1),
  ((SELECT id FROM spa_categories WHERE slug = 'addons'), 'addon-hot-oil-head', 'Hot Oil Head', 'Scented oil heated with lavender and tea tree oil drizzled throughout the scalp, followed by relaxing cranium massage. Nourishing for hair and scalp, relieves stress and tension headaches.', 15, 30.00, true, 2),
  ((SELECT id FROM spa_categories WHERE slug = 'addons'), 'addon-hands', 'Hands', 'Extra time to release joint and muscle pain in the hands.', 15, 30.00, true, 3),
  ((SELECT id FROM spa_categories WHERE slug = 'addons'), 'addon-feet', 'Feet', 'Extra time on tired and sore feet.', 15, 30.00, true, 4),
  ((SELECT id FROM spa_categories WHERE slug = 'addons'), 'addon-face', 'Face', 'Extra facial massage for headache or jaw pain relief. Uplifting and refreshing.', 15, 30.00, true, 5),
  ((SELECT id FROM spa_categories WHERE slug = 'addons'), 'addon-abdominals', 'Abdominals', 'Gentle abdominal massage to ease tension and aid digestion.', 15, 30.00, true, 6),
  ((SELECT id FROM spa_categories WHERE slug = 'addons'), 'addon-cupping', 'Cupping', 'Uses the therapeutic effect of suction pressure away from the body.', 15, 30.00, true, 7);

-- ============================================================
-- PRACTITIONERS
-- ============================================================
INSERT INTO practitioners (full_name, bio, languages, specialties, sort_order) VALUES
  ('Barbara', 'Barbara is a lifelong practitioner of body movement and massage. Her passion for promoting health and healing through massage has been a guiding force in her life for more than three decades. Her reputation speaks for itself, as do the testimonials from her clients. Barbara has training and certification in a variety of styles, and can help guide you to the massage style best suited to your needs.', ARRAY['en', 'fr', 'es', 'de'], ARRAY['Relaxation', 'Therapeutic', 'Yin Thai', 'Lomi Lomi', 'Ashiatsu', 'Chi Nei Tsang', 'Reiki', 'Cupping', 'Reflexology', 'Hot Stone', 'Lymphatic'], 1),
  ('Jenifer Rizo', 'Originally from Nicaragua, she has enjoyed living in Costa Rica for 18 years. She did her academic training in Cobano. Jenifer is a lover of natural medicine and therapy through her hands, which is why she decided to study massage and aesthetics at IECSA in 2017 in San Ramón. She really enjoys being a massage practitioner and is happy to be of service.', ARRAY['es', 'en'], ARRAY['Reflexology', 'Lymphatic', 'Body Wraps', 'Body Polish', 'Deep Tissue', 'Relaxing', 'Therapeutic', 'Facials', 'Kobido', 'Eastern'], 2);
