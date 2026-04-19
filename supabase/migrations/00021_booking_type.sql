-- Add booking_type column to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type text;

-- Backfill from lodging_types data
UPDATE bookings b
SET booking_type = CASE
  WHEN lt.occupancy_type = 'shared' THEN 'Shared'
  WHEN lt.occupancy_type = 'hotel' AND b.num_guests = 1 THEN 'Single Deluxe'
  WHEN lt.occupancy_type = 'hotel' AND b.num_guests = 2 THEN 'Double'
  WHEN lt.occupancy_type = 'hotel' AND b.num_guests >= 3 THEN 'Triple'
  ELSE NULL
END
FROM lodging_types lt
WHERE lt.id = b.lodging_type_id
  AND b.booking_type IS NULL;
