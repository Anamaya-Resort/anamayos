-- ============================================================
-- 00032: Anon-read policy on org_ai_provider_config
-- Needed by anamaya-website to read provider/model registry
-- Safe: no API keys in this table (only has_key boolean + role strings)
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "Anon read access" ON org_ai_provider_config FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
