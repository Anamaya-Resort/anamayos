-- ============================================================
-- 00030: Fixes for 00029 — missing index + cross-org guard
-- ============================================================

-- 1. Missing index on provider_id FK
CREATE INDEX IF NOT EXISTS idx_org_ai_config_provider ON org_ai_provider_config(provider_id);

-- 2. Prevent org from referencing another org's brand guide
CREATE OR REPLACE FUNCTION check_visitor_brand_guide_org()
RETURNS trigger AS $$
BEGIN
  IF NEW.visitor_agent_brand_guide_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM ai_brand_guide
      WHERE id = NEW.visitor_agent_brand_guide_id AND org_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'visitor_agent_brand_guide_id must belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_visitor_brand_guide ON organizations;
CREATE TRIGGER trg_check_visitor_brand_guide
  BEFORE INSERT OR UPDATE OF visitor_agent_brand_guide_id ON organizations
  FOR EACH ROW EXECUTE FUNCTION check_visitor_brand_guide_org();
