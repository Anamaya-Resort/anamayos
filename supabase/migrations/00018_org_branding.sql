-- Organization branding: per-org CSS variable overrides stored as JSONB
CREATE TABLE org_branding (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug   text NOT NULL UNIQUE DEFAULT 'default',
  branding   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE org_branding ENABLE ROW LEVEL SECURITY;

-- Service role (admin API) has full access
CREATE POLICY "Service role full access" ON org_branding
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER org_branding_updated_at BEFORE UPDATE ON org_branding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
