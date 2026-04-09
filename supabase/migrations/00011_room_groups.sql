-- AO Platform: Room groups and display order
-- Migration 00011

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_group TEXT;

-- Set room groups and sort order
UPDATE rooms SET room_group = 'upper', sort_order = 1 WHERE name ILIKE 'Casita%';
UPDATE rooms SET room_group = 'upper', sort_order = 2 WHERE name ILIKE 'Garuda%';
UPDATE rooms SET room_group = 'upper', sort_order = 3 WHERE name ILIKE 'Anahata%';
UPDATE rooms SET room_group = 'upper', sort_order = 4 WHERE name ILIKE 'Bali%';
UPDATE rooms SET room_group = 'upper', sort_order = 5 WHERE name ILIKE 'Jungle%';
UPDATE rooms SET room_group = 'upper', sort_order = 6 WHERE name ILIKE 'Prana%';
UPDATE rooms SET room_group = 'upper', sort_order = 7 WHERE name ILIKE 'Lotus%';
UPDATE rooms SET room_group = 'upper', sort_order = 8 WHERE name ILIKE 'Temple%';

UPDATE rooms SET room_group = 'lower', sort_order = 9 WHERE name ILIKE 'Gaia%';
UPDATE rooms SET room_group = 'lower', sort_order = 10 WHERE name ILIKE 'Ananda%';
UPDATE rooms SET room_group = 'lower', sort_order = 11 WHERE name ILIKE 'Hanuman%';
UPDATE rooms SET room_group = 'lower', sort_order = 12 WHERE name ILIKE 'Ganesh%';
UPDATE rooms SET room_group = 'lower', sort_order = 13 WHERE name ILIKE 'Shiva%';
UPDATE rooms SET room_group = 'lower', sort_order = 14 WHERE name ILIKE 'Mantra%';
UPDATE rooms SET room_group = 'lower', sort_order = 15 WHERE name ILIKE 'Dharma%';

CREATE INDEX IF NOT EXISTS idx_rooms_group ON rooms(room_group);
