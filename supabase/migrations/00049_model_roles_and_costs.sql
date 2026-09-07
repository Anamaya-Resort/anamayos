-- ══════════════════════════════════════════════════════════════
-- 00049 - Make the vision model a setting, and make cost real
--
-- Three problems:
--
-- 1. video_maker_model_roles was created in 00041 and never seeded,
--    so the worker hardcodes claude-sonnet-4-6 in ai/vision.ts and
--    picks Gemini for video frames purely as a side effect of
--    GEMINI_API_KEY being present in the environment. Changing model
--    means editing code and redeploying.
--
-- 2. Its price columns are int cents per 1k tokens. Sonnet input is
--    $3/Mtok = 0.3 cents/1k, which rounds to 0. Every current model
--    prices below 1 cent per 1k, so the column can only ever hold 0.
--
-- 3. video_cost_ledger is int cents, and the worker Math.ceil()s each
--    call into it. A $0.002 image books as 1 cent, overstating a
--    20,000 image run by roughly 5x.
-- ══════════════════════════════════════════════════════════════

-- 1. Real price columns ----------------------------------------
-- Per million tokens, in USD, 6dp. Covers everything from
-- Gemini Flash-Lite input ($0.10) to Opus output ($25.00).
ALTER TABLE video_maker_model_roles
  ADD COLUMN IF NOT EXISTS input_per_mtok_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS output_per_mtok_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS cached_input_per_mtok_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS supports_batch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN video_maker_model_roles.cost_per_1k_input_cents IS
  'DEPRECATED - int cents/1k rounds every current model to 0. Use input_per_mtok_usd.';
COMMENT ON COLUMN video_maker_model_roles.cost_per_1k_output_cents IS
  'DEPRECATED - see cost_per_1k_input_cents.';

-- 2. Sub-cent ledger -------------------------------------------
-- micro_cents = cents * 10000. One Gemini Flash-Lite image is about
-- 5000 micro-cents (0.05c), which the old int column recorded as 1c.
ALTER TABLE video_cost_ledger
  ADD COLUMN IF NOT EXISTS micro_cents bigint,
  ADD COLUMN IF NOT EXISTS model_endpoint text,
  ADD COLUMN IF NOT EXISTS input_tokens int,
  ADD COLUMN IF NOT EXISTS output_tokens int,
  ADD COLUMN IF NOT EXISTS cached_tokens int;

-- 3. Seed the roles + quota for every existing org --------------
-- 00041 defined seed_video_defaults() but nothing ever called it.
-- Vision defaults to Gemini 2.5 Flash: cheapest current option and
-- what 00041 always intended. Change the row, not the code.
INSERT INTO video_maker_model_roles
  (org_id, role, provider_id, model_endpoint,
   input_per_mtok_usd, output_per_mtok_usd, cached_input_per_mtok_usd,
   supports_batch, notes)
SELECT o.id, v.role, v.provider_id, v.model_endpoint,
       v.inp, v.outp, v.cached, v.batch, v.notes
FROM organizations o
CROSS JOIN (VALUES
  ('vision',  'google',    'gemini-2.5-flash',  0.30, 2.50, 0.03,  true,
   'Bulk first-pass tagging. Flash-Lite (0.10/0.40) is cheaper again if quality holds.'),
  ('caption', 'anthropic', 'claude-sonnet-5',   2.00, 10.00, 0.20, true,
   'Branded copy - quality matters more than unit cost here.'),
  ('script',  'anthropic', 'claude-sonnet-5',   2.00, 10.00, 0.20, true, NULL),
  ('edit',    'anthropic', 'claude-sonnet-5',   2.00, 10.00, 0.20, true, NULL),
  ('embed',   'openai',    'text-embedding-3-small', 0.02, 0.00, NULL, true, NULL),
  ('transcript','openai',  'whisper-1',         0.00, 0.00, NULL, false,
   'Priced per audio minute, not per token.')
) AS v(role, provider_id, model_endpoint, inp, outp, cached, batch, notes)
ON CONFLICT (org_id, role) DO NOTHING;

INSERT INTO video_org_quotas (org_id)
SELECT id FROM organizations
ON CONFLICT (org_id) DO NOTHING;

-- 4. Refresh the provider model catalogue ----------------------
-- ai_providers still advertises Sonnet 4.6 as the newest Claude and
-- knows nothing after Gemini 2.5. Both are a generation behind.
UPDATE ai_providers SET models = '[
  {"id":"claude-opus-5","name":"Claude Opus 5","type":"llm","active":true,"endpoint":"claude-opus-5"},
  {"id":"claude-sonnet-5","name":"Claude Sonnet 5","type":"llm","active":true,"endpoint":"claude-sonnet-5"},
  {"id":"claude-sonnet-4-6","name":"Claude Sonnet 4.6","type":"llm","active":false,"endpoint":"claude-sonnet-4-6"},
  {"id":"claude-haiku-4-5","name":"Claude Haiku 4.5","type":"llm","active":true,"endpoint":"claude-haiku-4-5"}
]'::jsonb, updated_at = now()
WHERE id = 'anthropic';

UPDATE ai_providers SET models = '[
  {"id":"gemini-3.8-flash","name":"Gemini 3.8 Flash","type":"llm","active":true,"endpoint":"gemini-3.8-flash"},
  {"id":"gemini-2.5-flash","name":"Gemini 2.5 Flash","type":"llm","active":true,"endpoint":"gemini-2.5-flash"},
  {"id":"gemini-2.5-flash-lite","name":"Gemini 2.5 Flash-Lite","type":"llm","active":true,"endpoint":"gemini-2.5-flash-lite"},
  {"id":"gemini-2.5-pro","name":"Gemini 2.5 Pro","type":"llm","active":true,"endpoint":"gemini-2.5-pro"}
]'::jsonb, updated_at = now()
WHERE id = 'google';

-- 5. Bakeoff results -------------------------------------------
-- Same images, several models, side by side. Kept as a table rather
-- than a throwaway script so a model change can always be justified
-- against the org's own photos instead of a pricing table.
CREATE TABLE IF NOT EXISTS video_model_bakeoff (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  model_key text NOT NULL,          -- label shown in the comparison
  provider_id text NOT NULL,
  model_endpoint text NOT NULL,
  summary text,
  aesthetic_score real,
  tags jsonb,
  detections jsonb,
  archetype_fit jsonb,
  input_tokens int,
  output_tokens int,
  cached_tokens int,
  micro_cents bigint,
  latency_ms int,
  error text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (run_id, asset_id, model_key)
);
CREATE INDEX IF NOT EXISTS idx_vmb_run ON video_model_bakeoff (run_id, model_key);

ALTER TABLE video_model_bakeoff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON video_model_bakeoff;
CREATE POLICY "Service role full access" ON video_model_bakeoff
  FOR ALL USING (true) WITH CHECK (true);
