-- Allow multiple named brand guides per org (was UNIQUE(org_id), now multiple)
ALTER TABLE ai_brand_guide DROP CONSTRAINT IF EXISTS ai_brand_guide_org_id_key;
ALTER TABLE ai_brand_guide ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Default';
CREATE UNIQUE INDEX IF NOT EXISTS ai_brand_guide_org_name ON ai_brand_guide(org_id, name);
