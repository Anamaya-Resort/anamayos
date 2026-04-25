-- ============================================================
-- 00031: Add missing override fields to org_properties
-- Properties need to override sensitive_topics and disclaimers
-- just like they can override tagline, locale, booking_url, etc.
-- ============================================================

ALTER TABLE org_properties ADD COLUMN IF NOT EXISTS sensitive_topics jsonb;
  -- null = inherit from parent org. Non-null = override.
ALTER TABLE org_properties ADD COLUMN IF NOT EXISTS disclaimers jsonb;
  -- null = inherit from parent org. Non-null = override.
