-- ============================================================
-- AI Data Sets — brand guide, customer archetypes, content prompts
-- Readable by anamaya-website via anon key (SELECT only)
-- ============================================================

-- Brand Guide — single row per org
CREATE TABLE ai_brand_guide (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  voice_tone text DEFAULT '',
  messaging_points jsonb DEFAULT '[]'::jsonb,
  usps jsonb DEFAULT '[]'::jsonb,
  personality_traits jsonb DEFAULT '[]'::jsonb,
  dos_and_donts jsonb DEFAULT '{"dos":[],"donts":[]}'::jsonb,
  compiled_context text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE ai_brand_guide ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ai_brand_guide FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON ai_brand_guide FOR SELECT USING (true);

-- Customer Archetypes — multiple per org
CREATE TABLE ai_customer_archetypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  demographics jsonb DEFAULT '{}'::jsonb,
  motivations jsonb DEFAULT '[]'::jsonb,
  pain_points jsonb DEFAULT '[]'::jsonb,
  content_tone text DEFAULT '',
  sample_messaging jsonb DEFAULT '[]'::jsonb,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_archetypes_org ON ai_customer_archetypes(org_id);

ALTER TABLE ai_customer_archetypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ai_customer_archetypes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON ai_customer_archetypes FOR SELECT USING (true);

-- Content Prompts — reusable prompt templates
CREATE TABLE ai_content_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  system_prompt text DEFAULT '',
  user_prompt_template text DEFAULT '',
  target_archetype_id uuid REFERENCES ai_customer_archetypes(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_prompts_org ON ai_content_prompts(org_id);

ALTER TABLE ai_content_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ai_content_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON ai_content_prompts FOR SELECT USING (true);

-- Add anon read to ai_providers too (for website to know which are connected)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_providers' AND policyname = 'Anon read access'
  ) THEN
    CREATE POLICY "Anon read access" ON ai_providers FOR SELECT USING (true);
  END IF;
END $$;
