-- Add test_branding column for per-admin test mode
ALTER TABLE org_branding ADD COLUMN IF NOT EXISTS test_branding jsonb;
