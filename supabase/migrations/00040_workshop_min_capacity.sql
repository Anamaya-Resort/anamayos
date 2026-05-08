-- ============================================================
-- 00040: Workshop minimum capacity
--
-- Adds `min_capacity` to retreat_workshops so operators can
-- record the minimum number of participants required for a
-- workshop to run. Existing rows default to NULL (no minimum).
-- ============================================================

ALTER TABLE retreat_workshops
  ADD COLUMN IF NOT EXISTS min_capacity int;

COMMENT ON COLUMN retreat_workshops.min_capacity IS
  'Minimum participants required for the workshop to run. NULL = no minimum.';

-- Sanity: min_capacity must be <= capacity when both are set,
-- and both must be non-negative.
ALTER TABLE retreat_workshops DROP CONSTRAINT IF EXISTS workshop_capacity_bounds;
ALTER TABLE retreat_workshops
  ADD CONSTRAINT workshop_capacity_bounds
  CHECK (
    (min_capacity IS NULL OR min_capacity >= 0)
    AND (capacity IS NULL OR capacity >= 0)
    AND (min_capacity IS NULL OR capacity IS NULL OR min_capacity <= capacity)
  );
