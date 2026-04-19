-- Booking flow enhancements

-- Bed arrangement field (queen, split_king, separate, single, bunk)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bed_arrangement text;

-- Performance indexes for availability queries
CREATE INDEX IF NOT EXISTS idx_bed_assignments_bed_status
  ON booking_bed_assignments(bed_id, status)
  WHERE status IN ('confirmed', 'pending_approval');

CREATE INDEX IF NOT EXISTS idx_bookings_room_dates
  ON bookings(room_id, check_in, check_out)
  WHERE status NOT IN ('cancelled', 'no_show');
