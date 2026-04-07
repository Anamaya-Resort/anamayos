-- AO Platform: Add missing indexes
-- Migration 00004

-- bookings.person_id — queried in RLS policies, booking list views, and detail pages
CREATE INDEX IF NOT EXISTS idx_bookings_person ON bookings(person_id);

-- leads.email — needed for lead-to-person matching and deduplication
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- leads.assigned_to_person — new FK column added in migration 00003
CREATE INDEX IF NOT EXISTS idx_leads_assigned_person ON leads(assigned_to_person);
