-- Add booking_type column to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type text;

-- Backfill from lodging_types data
-- RG "hotel" = Retreat Private (whole room for one person) = "Single Deluxe"
-- RG "shared" = Retreat Shared (guest books a bed in shared room)
UPDATE bookings b
SET booking_type = CASE
  WHEN lt.occupancy_type = 'shared' THEN 'Retreat Shared'
  WHEN lt.occupancy_type = 'hotel' THEN 'Single Deluxe'
  ELSE NULL
END
FROM lodging_types lt
WHERE lt.id = b.lodging_type_id
  AND b.booking_type IS NULL;
