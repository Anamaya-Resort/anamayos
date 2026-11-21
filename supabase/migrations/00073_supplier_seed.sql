-- ============================================================
-- 00073: Excursion + transport suppliers from
-- "Excursions and Providers.xlsx" (reception sheet), checked
-- against each supplier's own website on 2026-11-21.
--
-- Prices: base_price / variant price = the guest price before the
-- 13% IVA (added at checkout). net_price = what we pay the supplier.
-- Middlemen are recorded but inactive, with the reason, so nobody
-- re-adds them.
-- ============================================================

BEGIN;

-- Shared cancellation text from the reception sheet.
CREATE TEMP TABLE _txt (k TEXT PRIMARY KEY, v TEXT) ON COMMIT DROP;
INSERT INTO _txt VALUES
('std_cancel', $t$Free cancellation 24 hours or more before the activity. Same-day cancellations are charged 100%. Exception: illness or accident with documentation. If the operator cancels for weather or safety, there is no charge.$t$),
('crew_cancel', $t$Once the booking has started it cannot be cancelled: Montezuma Crew holds the whole week for the client and turns down other work. (Not published on their website.)$t$),
('outdoor_bring', $t$Light, comfortable clothes (leggings or long pants), closed-toe shoes, swimsuit, sunglasses, sunscreen, cap or hat, reusable water bottle, a light long-sleeve shirt for sun and mosquitoes.$t$),
('boat_bring', $t$Swimsuit, sunscreen, sunglasses, camera, towel, cash for extras.$t$),
('hotel_pickup', $t$Pick-up at Anamaya 15 minutes before the tour.$t$);

-- ── Suppliers ────────────────────────────────────────────────
INSERT INTO suppliers (slug, name, legal_name, kinds, contact_name, whatsapp, phone, email, website, address, booking_method, booking_notes, cancellation_policy, payment_terms, policies, verified_at, verification_notes, notes, is_active, sort_order) VALUES
('suntrails', 'Suntrails', NULL, '{excursions}', 'William (owner)', '+506 8467 8989', '+506 2224 7070', 'customer.service@suntrails.com', 'https://suntrails.com', 'Montezuma, Cóbano. About 800 m uphill (to the right) from the Anamaya main entrance.', 'whatsapp',
 $t$Montezuma waterfall wristbands: buy from Suntrails (William) at 1,000 colones each. Ask when we run out and say to invoice to "Yoga Life".$t$,
 (SELECT v FROM _txt WHERE k='std_cancel'), NULL, '{}',
 '2026-11-21', $t$Runs the zip line itself (own guides). Website: 9 cables / 13 platforms (sheet said 12), 100 kg weight limit, Curú pickup 8:00 AM (sheet said 7:30). Email on site is customer.service@ (sheet had info@). 2224-7070 is a San José number but it is on their own site. Also sells Tortuga Island, bioluminescence and transfers; not confirmed those are their own boats/vans, so not listed.$t$,
 NULL, true, 10),

('zuma-tours', 'Zuma Tours', NULL, '{excursions,transport}', NULL, '+506 8840 4389', '+506 2642 0024', 'info@zumatours.net', 'https://www.zumatours.net', 'Montezuma office on the beach side, in front of the football field. Also Plaza Kahuna (Santa Teresa) and Jacó.', 'whatsapp', NULL,
 (SELECT v FROM _txt WHERE k='std_cancel'), 'Supplier charges at booking.', '{}',
 '2026-11-21', $t$Own boats (32 ft and 42 ft speedboats, catamaran). Their land tours (zip line, ATV, horses) are resold from other operators, so only their boat trips are listed. Their own site prices INCLUDE tax and are lower than our sheet: Tortuga $87, sunset & bioluminescence $87, water taxi to Jacó $60 (children 6-12 $55/$55/$40, under 5 free). Tortuga needs at least 8 people to run. Bioluminescence tour does not run from crescent to full moon.$t$,
 NULL, true, 20),

('iguana-divers', 'Iguana Divers', NULL, '{excursions}', NULL, '+506 8764 2462', '+506 8764 2462', 'info@iguanadivers.com', 'https://www.iguanadivers.com', 'Plaza Kahuna, Santa Teresa. Open Mon-Sat 9 AM - 4 PM.', 'whatsapp', NULL,
 $t$Full payment at booking. Cancelling less than 48 hours before is charged in full. Bad weather: reschedule or full refund.$t$, 'Full payment at booking.', '{}',
 '2026-11-21', $t$PADI 5 Star, own boats: "Blas de Lezo" (panga) and "Go Under" (RIB; sheet said "Go"). Our sheet had WhatsApp 8438 5887, which is not on their site; the site lists 8764 2462. Discover Scuba is $220 tax included on their site (sheet adds tax on top). Wildlife boat trip is 4 hours (sheet said 3). Their site lists humpbacks Aug-Sep. Boat transport to Malpaís is not included.$t$,
 NULL, true, 30),

('surf-by-the-wave', 'Surf By The Wave', 'Surf School By The Wave', '{excursions}', NULL, '+506 8798 4769', NULL, 'contact@surfbythewave.com', 'https://www.surfbythewave.com', 'Montezuma, Santa Teresa and Cabuya.', 'whatsapp', NULL,
 (SELECT v FROM _txt WHERE k='std_cancel'), NULL, '{}',
 '2026-11-21', $t$Own instructors (Costa Rican, ISA certified, max 3 students per instructor). Sheet WhatsApp "879847" was missing digits; website has 8798 4769. Site prices match our sheet ($70 group, $100 private, 2 hours). Also: 2 lessons $130 group / $190 private, intermediate private $120, kids lessons.$t$,
 NULL, true, 40),

('montezuma-crew', 'Montezuma Crew', NULL, '{excursions}', 'Michele "Miki" Borsari Schettini (instructor), Captain Chema', '+506 8823 0831', '+506 8823 0831', 'montezumadiveacademy@gmail.com', 'https://www.montezumacrew.com', NULL, 'whatsapp', NULL,
 (SELECT v FROM _txt WHERE k='crew_cancel'), 'PayPal adds 6%.', '{}',
 '2026-11-21', $t$Own crew and boat (new 32 ft, twin 150 HP Yamaha, bathroom and shower). Sheet WhatsApp had an extra 0. Their dive course on the site is CMAS 1-star Open Water, $650 (5 pool + 5 theory + 4 sea dives); our $630 net / $700 public is likely a quote to us. Blue Mind pool therapy and the 2-angler fishing rates are not on their site. Inshore fishing on site is 8 AM - 1 PM. Private Dream Tour on the site is about 6 hours (sheet said 4.5), no price shown.$t$,
 NULL, true, 50),

('tropical-tours', 'Tropical Tours', 'Sunset & Waves Tropical Tours R y V S.A.', '{transport,excursions}', NULL, '+506 8890 9197', '+506 2640 1900', 'info@tropicaltourshuttles.com', 'https://tropicaltourshuttles.com', 'In front of Banco Nacional, Santa Teresa.', 'whatsapp', NULL,
 $t$Cancel 48 hours or more before for a refund. No-shows are not refunded.$t$, NULL,
 '{"wait": "Driver waits 10 minutes at hotels, 15 at airports.", "luggage": "2 large bags, 1 small bag and 1 carry-on per person.", "children": "Age 3 and up pays full fare.", "pets": "No pets on shared shuttles."}',
 '2026-11-21', $t$Family-owned since 2005, about 12 minibuses and 2 Toyota Prado. Some routes use partner companies. Our sheet had WhatsApp 8663 4994, which is not theirs (it is also on our "Santa Teresa Adventure" row); their site lists 8890 9197 and 2640 0811. Shuttles leave Montezuma 6:45 AM and 3:15 PM (sheet said 6:50). Fishing is not on their website. Also run taxi boats (e.g. Montezuma to Jacó $60, Manuel Antonio $85, Uvita $110).$t$,
 NULL, true, 60),

('transprado', 'Transprado', NULL, '{transport}', NULL, '+506 8811 1896', NULL, 'reservations@transprado.com', 'https://transprado.com', NULL, 'whatsapp', NULL,
 $t$Free changes up to 48 hours before. Full refund more than 48 hours before; no refund within 24 hours. No-show: no refund. If a passenger leaves early: no partial refund. If Transprado cancels: another time, an equivalent service, or a full refund.$t$, NULL,
 '{"wait": "Driver waits 10 minutes at hotels; private airport pickups wait 120 minutes after an international landing.", "luggage": "1 suitcase up to 23 kg plus 1 carry-on included. Extra bag $10 + tax. Surfboard $10, bike $15, wheelchair $10, camera gear $15. Not responsible for valuables (passports, laptops, medicine, cash, jewellery, phones, cameras).", "children": "Under 3 free. Age 3 and up pays full fare and needs a child or booster seat. Baby seats on request, not guaranteed unless booked ahead. Minors travel with an adult.", "pets": "Pets declared in advance, in a carrier, $15. Certified guide dogs welcome."}',
 '2026-11-21', $t$Sheet said 24 hours for changes and refunds; their site says 48. Our sheet had WhatsApp 8989 6751; their site lists 8811 1896. Small local operator covering Nicoya Peninsula routes (site is new, 2025-2026). Prices from their site, before 13% tax.$t$,
 NULL, true, 70),

('marino-segura', 'Marino Segura', NULL, '{transport}', 'Marino Segura', '+506 8815 9075', NULL, NULL, NULL, NULL, 'whatsapp', NULL, NULL, NULL, '{}',
 NULL, 'Independent taxi driver; no website to check.', 'Private taxi to anywhere. Price on request.', true, 80),

('josue-villalobos', 'Josue Villalobos', NULL, '{transport}', 'Josue Villalobos', '+506 8721 6277', NULL, NULL, NULL, NULL, 'whatsapp', NULL, NULL, NULL, '{}',
 NULL, 'Independent taxi driver; no website to check.', 'Private taxi to anywhere. Price on request.', true, 90),

-- Not listed: middlemen / unverified.
('montezuma-tour', 'Montezuma Tour', 'Montezuma Tours', '{excursions,transport}', 'Alex', '+506 8421 1166', '+506 2642 0467', 'info@montezumatour.com', 'https://montezumatour.com', 'In front of Super Montezuma; second office at the Cóbano airport.', 'whatsapp', NULL,
 '48 hours notice; refund if weather cancels.', NULL, '{}',
 '2026-11-21', $t$NOT LISTED: mostly a booking office reselling other operators (14 activities incl. fishing, scuba, taxi boat, zip line with the same times as Suntrails and Zuma; reviews describe them arranging a captain). Unclear whether they own the horses or employ the bird guide. If they do, horseback riding ($65, 3.5 h, beach at low tide or mountain 9 AM / 2 PM) and bird watching ($65, 3.5 h, starts 5:30 AM; sheet said 5:15) could be added back.$t$,
 'From the reception sheet.', false, 900),

('santa-teresa-adventure', 'Santa Teresa Adventure', NULL, '{transport}', NULL, '+506 8663 4994', NULL, NULL, NULL, NULL, 'whatsapp', NULL, NULL, NULL, '{}',
 '2026-11-21', $t$NOT LISTED: santateresaadventures.com is a parked for-sale domain and no business by this name was found. Its WhatsApp (8663 4994) is the same number our sheet gave Tropical Tours and is not on any official site. Sheet said shuttles to San José, La Fortuna, Monteverde $60-82, 6:50 AM from Anamaya. Ask who added it.$t$,
 'From the reception sheet.', false, 910)
ON CONFLICT (slug) DO NOTHING;

-- ── Products ─────────────────────────────────────────────────
CREATE TEMP TABLE _p (
  slug TEXT, supplier TEXT, cat TEXT, ptype product_type, name TEXT, description TEXT,
  base NUMERIC, net NUMERIC, unit TEXT, on_request BOOLEAN, minutes INT, min_p INT, max_p INT, min_age INT,
  schedule TEXT, season TEXT, includes TEXT, bring TEXT, meet TEXT, cancel TEXT, price_notes TEXT, internal TEXT, sort INT
) ON COMMIT DROP;

INSERT INTO _p VALUES
('suntrails-zipline-waterfall', 'suntrails', 'excursions-adventure', 'activity', 'Zip Line & Montezuma Waterfall',
 $t$Nature trails, waterfalls and ocean views from the treetops: 9 cables and 13 platforms, with a swim below the famous Montezuma waterfalls.$t$,
 55, 44, 'person', false, NULL, 2, 18, NULL, '9:00 AM, 1:00 PM, 3:00 PM', NULL,
 'Guide, safety equipment and water.', (SELECT v FROM _txt WHERE k='outdoor_bring') || ' Insect repellent. Max weight 100 kg.',
 'Guests walk on their own: leave 20 minutes before, turn right on the main road and walk about 800 m uphill to the Suntrails office. Hand the voucher with participant names to their receptionist.',
 (SELECT v FROM _txt WHERE k='std_cancel'), NULL, NULL, 10),

('suntrails-curu-hike', 'suntrails', 'excursions-nature', 'activity', 'Curú National Park Hike',
 $t$A wildlife lover's favourite: trails full of birds, mammals and reptiles, with a certified bilingual guide and spotting equipment.$t$,
 NULL, NULL, 'person', false, 330, 2, NULL, NULL, 'Daily, pickup 8:00 AM, back about 1:00 PM', NULL,
 'Transport, park tickets, certified bilingual guide, wildlife-viewing equipment, drinks and fruit.', 'Closed-toe shoes, camera, insect repellent, sunglasses, walking clothes.',
 (SELECT v FROM _txt WHERE k='hotel_pickup'), (SELECT v FROM _txt WHERE k='std_cancel'), 'Per person: $125 for 2 people, $85 for 4 or more (net $100 / $68).', 'Sheet said 7:30 AM; Suntrails site says 8:00 AM pickup.', 20),

('zuma-tortuga-snorkel-bbq', 'zuma-tours', 'excursions-water', 'activity', 'Isla Tortuga Snorkeling & BBQ',
 $t$A beautiful island in the Gulf of Nicoya, about 45 minutes by speedboat. Snorkel among plenty of marine life, then lunch on the island.$t$,
 90, 72, 'person', false, 420, 8, NULL, NULL, 'Daily, 9:00 AM - 4:00 PM (check in 8:45 AM at the Zuma office)', NULL,
 'Transport, captain, guide, cook, snorkel gear, lunch on the island, fruit, soft drinks.', (SELECT v FROM _txt WHERE k='boat_bring'),
 'Zuma Tours office, Montezuma beach, in front of the football field.', (SELECT v FROM _txt WHERE k='std_cancel'), NULL, 'Needs at least 8 people to run. Zuma''s own price is $87 tax included.', 30),

('zuma-sunset-bioluminescence', 'zuma-tours', 'excursions-water', 'activity', 'Tortuga Island Sunset & Bioluminescence',
 $t$A 35-minute boat ride along the coast to Tortuga Island, arriving after the crowds leave. Swim or snorkel from the boat, relax on the beach, enjoy Costa Rican "gallos" tacos and fruit around 4:30 PM, watch the sunset over Tambor Bay, then look for glowing bioluminescent water after dark (from the boat or in the water). Life jackets and goggles provided; calm water close to shore.$t$,
 100, NULL, 'person', false, NULL, NULL, NULL, NULL, 'Pickup about 1:20 PM; back in Montezuma about 7:45 PM', 'Not run from crescent moon to full moon',
 'Transport, guide, gallos tacos and fruit, life jackets and goggles.', (SELECT v FROM _txt WHERE k='boat_bring'),
 (SELECT v FROM _txt WHERE k='hotel_pickup') || ' Check-in at Bahía Ballena dock, Tambor.', (SELECT v FROM _txt WHERE k='std_cancel'), NULL, 'Net price missing on our sheet. Zuma''s own price is $87 tax included. Sheet said 12:30-8:30 PM.', 40),

('zuma-water-taxi-jaco', 'zuma-tours', 'transfers-boat', 'transfer', 'Water Taxi Montezuma - Jacó',
 $t$The fastest way across the Gulf of Nicoya: one hour by covered speedboat from Tambor Bay to Herradura (just north of Jacó), with a chance to see dolphins, rays, turtles and, in season, whales. Reservations in advance required.$t$,
 50, NULL, 'person', false, 60, NULL, 40, NULL, 'Shuttle from Montezuma 7:20-7:30 AM, boat leaves Tambor 8:30 AM. Return leaves Herradura 10:00 AM.', NULL,
 'Shuttle to the dock, boat crossing, life jackets.', 'Remove shoes for wading on and off. Waterproof bags for luggage and electronics. Sunscreen. Rain jacket in green season. Life jacket mandatory.',
 (SELECT v FROM _txt WHERE k='hotel_pickup'), (SELECT v FROM _txt WHERE k='std_cancel'), NULL, 'Luggage up to 22 kg; extra bag $10, surfboard $10-20. Zuma''s own price is $60 tax included.', 50),

('iguana-discover-scuba', 'iguana-divers', 'excursions-diving', 'activity', 'Discover Scuba Diving',
 $t$Breathe underwater for the first time. A one-day intro (not a certification): a pool session to learn the basics, then 2 ocean dives under an instructor's direct supervision, to a maximum of 12 m. No experience needed, reasonable health required.$t$,
 220, NULL, 'person', false, NULL, NULL, NULL, 10, 'One day: pool + 2 ocean dives', NULL,
 'PADI instructor, equipment, pool session, 2 ocean dives.', NULL,
 'Iguana Divers, Plaza Kahuna, Santa Teresa. Transport to the boat is not included.', 'Full payment at booking. Cancelling less than 48 hours before is charged in full.', NULL, 'Iguana''s own price is $220 tax included.', 60),

('iguana-wildlife-whale-boat', 'iguana-divers', 'excursions-water', 'activity', 'Whale Watching & Wildlife Boat',
 $t$Humpback whales migrate to the Nicoya Peninsula. Starts with a short talk on whale biology, then a boat trip with a knowledgeable guide, listening to whale song on a hydrophone, plus a snorkel stop at Cemetery Island, Cabuya. Respectful whale-watching practices. All ages.$t$,
 NULL, NULL, NULL, false, 240, NULL, NULL, NULL, NULL, 'Humpbacks Jul/Aug - Sep',
 'Guide, hydrophone, snorkel stop.', NULL,
 (SELECT v FROM _txt WHERE k='hotel_pickup'), 'Full payment at booking. Cancelling less than 48 hours before is charged in full.', 'Group $85 per person (minimum 5). Private panga "Blas de Lezo" up to 6: $500. Private RIB "Go Under" up to 10: $795.', NULL, 70),

('surf-lesson-playa-grande', 'surf-by-the-wave', 'excursions-surf', 'activity', 'Surf Lesson at Playa Grande',
 $t$Surf at Playa Grande, Montezuma: a beautiful beach surrounded by nature, with waves ideal for beginners. Includes a 40-minute hike on beach and jungle trails (some uphill, moderate fitness). Patient, professional instructors adapt the class to each level. Water and fresh fruit on arrival.$t$,
 NULL, NULL, 'person', false, 120, NULL, NULL, NULL, 'Changes weekly with the tide; check with reception', NULL,
 'Instructor, board, rash vest, safety briefing, water and fruit. Private adds theory and video analysis.', 'Comfortable clothes and closed-toe shoes for the walk, clothes for the class, sandals, towel, 2 L of water.',
 (SELECT v FROM _txt WHERE k='hotel_pickup'), (SELECT v FROM _txt WHERE k='std_cancel'), NULL, NULL, 80),

('crew-dive-course', 'montezuma-crew', 'excursions-diving', 'activity', 'Scuba Diving Course',
 $t$Learn to dive with a CMAS / HSA instructor. Pool sessions at Anamaya, then dives from Playa Las Manchas and the private pier at Bahía Ballena Yacht Club. No age limit; also great for people who don't feel comfortable in the sea, using "Blue Mind" exercises.$t$,
 700, 630, 'person', false, NULL, NULL, NULL, NULL, '8:30 AM - 4:00 PM', NULL,
 'Instructor, equipment, transport if needed.', NULL,
 'Pool at Anamaya; dives from Playa Las Manchas / Bahía Ballena Yacht Club.', (SELECT v FROM _txt WHERE k='crew_cancel'), NULL, 'Their website sells a CMAS 1-star Open Water course at $650 (5 pool + 5 theory + 4 sea dives). Confirm which course our $700 is.', 90),

('crew-blue-mind', 'montezuma-crew', 'excursions-diving', 'activity', 'Blue Mind Pool Diving',
 $t$Pool diving as personal therapy: controlled breathing and weightlessness to reduce stress and anxiety and bring a deep calm known as "Blue Mind". Good for emotional balance, rehabilitation and relaxation, and a lot of fun. Guided by Michele Borsari Schettini, CMAS and HSA instructor with 25+ years of experience. No diving or swimming experience needed, no age limit.$t$,
 80, NULL, 'person', false, 60, NULL, 1, NULL, 'Flexible; usually one hour', NULL,
 'Private 1-hour class, equipment.', NULL, 'Anamaya pool.', (SELECT v FROM _txt WHERE k='crew_cancel'), NULL, NULL, 100),

('crew-private-dive-boat', 'montezuma-crew', 'excursions-water', 'activity', 'Private Dive Boat: Isla Tortuga & Playa Muerto',
 $t$A private trip for couples, friends or families on a new 32 ft boat with bathroom and shower, from Bahía Ballena Yacht Club, Tambor. First dive at "the Aquarium" off Tortuga Island, second chosen by conditions (licensed divers; all gear provided). Time on 1-2 white-sand beaches, chances of whales, dolphins and turtles, and a tropical brunch on board with fruit, pizza or empanadas, juices, water and beer.$t$,
 NULL, NULL, 'boat', true, 360, NULL, NULL, NULL, 'Flexible; about 8:30 AM - 2:30 PM', NULL,
 'Boat and crew, dive instructor, all gear, brunch, juices, water, beer.', NULL,
 'Bahía Ballena Yacht Club pier, Tambor.', (SELECT v FROM _txt WHERE k='crew_cancel'), 'Price on request.', 'Sheet said 4.5 hours; their site says about 6.', 110),

('crew-fishing', 'montezuma-crew', 'excursions-fishing', 'activity', 'Fishing Trip with Captain Chema',
 $t$Deep sea, 20-25 miles offshore: sailfish, marlin, tuna, mahi-mahi and wahoo (sailfish and marlin are released). Inshore, around rocks, reefs, river mouths and estuaries: roosterfish, tuna, snapper, jacks, mackerel and snook, jigging or trolling.$t$,
 NULL, NULL, 'boat', false, NULL, NULL, 4, NULL, 'Inshore 8:00 AM - 1:00 PM; deep sea 7:00 AM - 4:00 PM', NULL,
 'Bilingual captain and mate, all gear and bait, soft drinks, beer, snacks, fruit; lunch (pizza and more) on long trips.', 'Good attitude, sunglasses, sunscreen, hat, long-sleeve shirt, sandals (no hard-sole shoes).',
 'Bahía Ballena pier, Tambor.', (SELECT v FROM _txt WHERE k='crew_cancel'), 'Per boat, up to 4 anglers.', 'Sheet said inshore 7:45 AM; their site says 8:00 AM.', 120),

('tropical-shared-shuttle', 'tropical-tours', 'transfers-shuttle', 'transfer', 'Shared Shuttle (Tropical Tours)',
 $t$Shared shuttle from Anamaya to airports and main destinations.$t$,
 NULL, NULL, 'person', false, NULL, NULL, NULL, NULL, 'Leaves Montezuma 6:45 AM and 3:15 PM (La Fortuna and Monteverde 6:45 AM only)', NULL,
 NULL, NULL, 'Pickup at Anamaya.', $t$Cancel 48 hours or more before for a refund. No-shows are not refunded.$t$, 'Our sheet: net $60-75. Prices below are from their website.', NULL, 130),

('tropical-private-transfer', 'tropical-tours', 'transfers-private', 'transfer', 'Private Transfer (Tropical Tours)',
 $t$Private van or SUV from Anamaya.$t$,
 NULL, NULL, 'vehicle', false, NULL, NULL, NULL, NULL, 'Any time', NULL,
 NULL, NULL, 'Pickup at Anamaya.', $t$Cancel 48 hours or more before for a refund. No-shows are not refunded.$t$, '"From" prices on their website; other routes on request.', NULL, 140),

('tropical-fishing', 'tropical-tours', 'excursions-fishing', 'activity', 'Fishing Trip (Tropical Tours)',
 $t$Fishing trip with Tropical Tours.$t$,
 NULL, NULL, 'boat', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Price on request.', 'Not on their website; details to confirm with Tropical Tours.', 150),

('transprado-shared-shuttle', 'transprado', 'transfers-shuttle', 'transfer', 'Shared Shuttle (Transprado)',
 $t$Shared shuttle from Montezuma. All reservations subject to availability. Check the date, time, destination, passengers and pickup are right. Times can vary with traffic, weather and roads, so avoid tight flight connections.$t$,
 NULL, NULL, 'person', false, NULL, NULL, NULL, NULL, 'Guanacaste 8:30 AM; Cóbano and Santa Teresa 10 AM, 1 PM, 4 PM', NULL,
 '1 suitcase (23 kg) + 1 carry-on.', NULL, 'Pickup at Anamaya. Driver waits 10 minutes.', $t$Free changes up to 48 hours before. Full refund more than 48 hours before; no refund within 24 hours. No-show: no refund.$t$, NULL, NULL, 160),

('transprado-private-transfer', 'transprado', 'transfers-private', 'transfer', 'Private Transfer (Transprado)',
 $t$Private transfer from Montezuma for up to 4 people (each extra person $7.50-50 depending on route).$t$,
 NULL, NULL, 'vehicle', false, NULL, NULL, 4, NULL, 'Any time', NULL,
 '1 suitcase (23 kg) + 1 carry-on per person.', NULL, 'Pickup at Anamaya. Driver waits 10 minutes; airport pickups wait 120 minutes after landing.', $t$Free changes up to 48 hours before. Full refund more than 48 hours before; no refund within 24 hours. No-show: no refund.$t$, NULL, NULL, 170),

('taxi-marino-segura', 'marino-segura', 'transfers-private', 'transfer', 'Private Taxi (Marino Segura)',
 $t$Private taxi to any destination.$t$, NULL, NULL, 'vehicle', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Pickup at Anamaya.', NULL, 'Price on request.', NULL, 180),

('taxi-josue-villalobos', 'josue-villalobos', 'transfers-private', 'transfer', 'Private Taxi (Josue Villalobos)',
 $t$Private taxi to any destination.$t$, NULL, NULL, 'vehicle', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Pickup at Anamaya.', NULL, 'Price on request.', NULL, 190);

INSERT INTO products (slug, product_type, name, description, short_description, base_price, net_price, price_unit, price_on_request, duration_minutes,
  min_participants, max_participants, min_age, schedule, season, includes, what_to_bring, meeting_point, cancellation_policy, price_notes, internal_notes,
  supplier_id, sort_order, is_active)
SELECT p.slug, p.ptype, p.name, p.description, NULL, p.base, p.net, p.unit, p.on_request, p.minutes,
  p.min_p, p.max_p, p.min_age, p.schedule, p.season, p.includes, p.bring, p.meet, p.cancel, p.price_notes, p.internal,
  s.id, p.sort, true
FROM _p p JOIN suppliers s ON s.slug = p.supplier
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_category_map (product_id, category_id, is_primary)
SELECT pr.id, c.id, true FROM _p p JOIN products pr ON pr.slug = p.slug JOIN product_categories c ON c.slug = p.cat
ON CONFLICT DO NOTHING;

-- ── Price options (variants) ─────────────────────────────────
INSERT INTO product_variants (product_id, slug, name, price, net_price, min_participants, max_participants, duration_minutes, sort_order)
SELECT pr.id, v.slug, v.name, v.price, v.net, v.min_p, v.max_p, v.minutes, v.sort
FROM (VALUES
  ('suntrails-curu-hike',        '2-people',     '2 people (per person)',      125,    100, 2, NULL,    NULL, 1),
  ('suntrails-curu-hike',        '4-plus',       '4+ people (per person)',      85,     68, 4, NULL, NULL, 2),
  ('iguana-wildlife-whale-boat', 'group',        'Group (per person, min 5)',   85,   NULL, 5, NULL, NULL, 1),
  ('iguana-wildlife-whale-boat', 'private-panga','Private panga, up to 6',     500,   NULL, NULL, 6, NULL, 2),
  ('iguana-wildlife-whale-boat', 'private-rib',  'Private RIB, up to 10',      795,   NULL, NULL, 10, NULL, 3),
  ('surf-lesson-playa-grande',   'group',        'Group',                       70,     66, NULL, 3, NULL, 1),
  ('surf-lesson-playa-grande',   'private',      'Private',                    100,   NULL, NULL, 1, NULL, 2),
  ('crew-fishing',               'inshore-4',    'Inshore half day, up to 4',  700,   NULL, NULL, 4, 300, 1),
  ('crew-fishing',               'inshore-2',    'Inshore half day, 2 anglers',600,   NULL, NULL, 2, 300, 2),
  ('crew-fishing',               'deep-4',       'Deep sea, up to 4',         1300,   NULL, NULL, 4, 540, 3),
  ('crew-fishing',               'deep-2',       'Deep sea, 2 anglers',       1200,   NULL, NULL, 2, 540, 4),
  ('tropical-shared-shuttle',    'liberia',      'Liberia Airport',             60,   NULL, NULL, NULL, NULL, 1),
  ('tropical-shared-shuttle',    'san-jose',     'San José Airport',            50,   NULL, NULL, NULL, NULL, 2),
  ('tropical-shared-shuttle',    'guanacaste',   'Tamarindo / Nosara / Sámara', 60,   NULL, NULL, NULL, NULL, 3),
  ('tropical-shared-shuttle',    'la-fortuna',   'La Fortuna',                  85,   NULL, NULL, NULL, NULL, 4),
  ('tropical-shared-shuttle',    'monteverde',   'Monteverde',                  85,   NULL, NULL, NULL, NULL, 5),
  ('tropical-private-transfer',  'liberia',      'Liberia (from)',             240,   NULL, NULL, NULL, NULL, 1),
  ('tropical-private-transfer',  'tamarindo',    'Tamarindo (from)',           260,   NULL, NULL, NULL, NULL, 2),
  ('transprado-shared-shuttle',  'guanacaste',   'Liberia / Tamarindo / Nosara / Sámara', 54.24, NULL, NULL, NULL, NULL, 1),
  ('transprado-shared-shuttle',  'santa-teresa', 'Santa Teresa / Malpaís',   15.82,   NULL, NULL, NULL, NULL, 2),
  ('transprado-shared-shuttle',  'cobano',       'Cóbano',                   11.75,   NULL, NULL, NULL, NULL, 3),
  ('transprado-private-transfer','cobano',       'Cóbano',                      27,   NULL, NULL, 4, NULL, 1),
  ('transprado-private-transfer','tambor',       'Tambor',                      48,   NULL, NULL, 4, NULL, 2),
  ('transprado-private-transfer','paquera',      'Paquera ferry',               86,   NULL, NULL, 4, NULL, 3),
  ('transprado-private-transfer','san-jose',     'San José / SJO Airport',     269,   NULL, NULL, 4, NULL, 4),
  ('transprado-private-transfer','liberia',      'Liberia Airport',            269,   NULL, NULL, 4, NULL, 5),
  ('transprado-private-transfer','tamarindo',    'Tamarindo',                  269,   NULL, NULL, 4, NULL, 6),
  ('transprado-private-transfer','monteverde',   'Monteverde',                 269,   NULL, NULL, 4, NULL, 7),
  ('transprado-private-transfer','manuel-antonio','Manuel Antonio',            288,   NULL, NULL, 4, NULL, 8),
  ('transprado-private-transfer','la-fortuna',   'La Fortuna',                 307,   NULL, NULL, 4, NULL, 9),
  ('transprado-private-transfer','uvita',        'Uvita',                      365,   NULL, NULL, 4, NULL, 10)
) AS v(product, slug, name, price, net, min_p, max_p, minutes, sort)
JOIN products pr ON pr.slug = v.product
ON CONFLICT ON CONSTRAINT unique_variant_slug DO NOTHING;

COMMIT;
