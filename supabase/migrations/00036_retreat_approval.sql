-- ============================================================
-- 00034: Retreat approval workflow fields
-- ============================================================

ALTER TABLE retreats ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE retreats ADD COLUMN IF NOT EXISTS approval_notes text;

DO $$ BEGIN
  ALTER TABLE retreats
    ADD CONSTRAINT retreats_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES persons(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
