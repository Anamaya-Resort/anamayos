-- Make profile_id nullable since we now use person_id
-- Also drop the deprecated assigned_to on leads

ALTER TABLE bookings ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN profile_id DROP DEFAULT;
