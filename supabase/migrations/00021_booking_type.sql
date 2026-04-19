-- Add booking_type column to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type text;

-- Backfill from lodging_types data
-- RG "hotel" = guest books whole room privately
-- RG "shared" = retreat shared room (guests share with other participants)
UPDATE bookings b
SET booking_type = CASE
  WHEN lt.occupancy_type = 'shared' THEN 'Retreat Shared'
  WHEN lt.occupancy_type = 'hotel' AND b.num_guests = 1 THEN 'Private Single'
  WHEN lt.occupancy_type = 'hotel' AND b.num_guests = 2 THEN 'Private Double'
  WHEN lt.occupancy_type = 'hotel' AND b.num_guests >= 3 THEN 'Private Triple'
  ELSE NULL
END
FROM lodging_types lt
WHERE lt.id = b.lodging_type_id
  AND b.booking_type IS NULL;
