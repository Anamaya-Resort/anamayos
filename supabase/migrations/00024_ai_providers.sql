-- AI provider registry — stores provider metadata + model list
CREATE TABLE IF NOT EXISTS ai_providers (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_connected boolean DEFAULT false,
  last_tested_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ai_providers FOR ALL USING (true) WITH CHECK (true);

-- Seed providers with current models
INSERT INTO ai_providers (id, display_name, models) VALUES
  ('anthropic', 'Claude / Anthropic', '[
    {"id":"claude-opus-4-6","name":"Claude Opus 4.6","type":"llm","endpoint":"claude-opus-4-6","active":true,"added_at":"2026-04-23"},
    {"id":"claude-sonnet-4-6","name":"Claude Sonnet 4.6","type":"llm","endpoint":"claude-sonnet-4-6","active":true,"added_at":"2026-04-23"},
    {"id":"claude-haiku-4-5","name":"Claude Haiku 4.5","type":"llm","endpoint":"claude-haiku-4-5-20251001","active":true,"added_at":"2026-04-23"}
  ]'::jsonb),
  ('google', 'Gemini / Google', '[
    {"id":"gemini-2.5-pro","name":"Gemini 2.5 Pro","type":"llm","endpoint":"gemini-2.5-pro","active":true,"added_at":"2026-04-23"},
    {"id":"gemini-2.5-flash","name":"Gemini 2.5 Flash","type":"llm","endpoint":"gemini-2.5-flash","active":true,"added_at":"2026-04-23"},
    {"id":"gemini-2.0-flash","name":"Gemini 2.0 Flash","type":"llm","endpoint":"gemini-2.0-flash","active":true,"added_at":"2026-04-23"},
    {"id":"gemini-2.0-flash-image","name":"Gemini 2.0 Flash (Image)","type":"image","endpoint":"gemini-2.0-flash","active":true,"added_at":"2026-04-23"}
  ]'::jsonb),
  ('openai', 'ChatGPT / OpenAI', '[
    {"id":"gpt-4.1","name":"GPT-4.1","type":"llm","endpoint":"gpt-4.1","active":true,"added_at":"2026-04-23"},
    {"id":"gpt-4.1-mini","name":"GPT-4.1 Mini","type":"llm","endpoint":"gpt-4.1-mini","active":true,"added_at":"2026-04-23"},
    {"id":"gpt-4.1-nano","name":"GPT-4.1 Nano","type":"llm","endpoint":"gpt-4.1-nano","active":true,"added_at":"2026-04-23"},
    {"id":"o3","name":"o3","type":"llm","endpoint":"o3","active":true,"added_at":"2026-04-23"},
    {"id":"o4-mini","name":"o4-mini","type":"llm","endpoint":"o4-mini","active":true,"added_at":"2026-04-23"},
    {"id":"gpt-image-1","name":"GPT Image 1","type":"image","endpoint":"gpt-image-1","active":true,"added_at":"2026-04-23"}
  ]'::jsonb),
  ('xai', 'Grok / xAI', '[
    {"id":"grok-3","name":"Grok 3","type":"llm","endpoint":"grok-3","active":true,"added_at":"2026-04-23"},
    {"id":"grok-3-mini","name":"Grok 3 Mini","type":"llm","endpoint":"grok-3-mini","active":true,"added_at":"2026-04-23"},
    {"id":"grok-3-fast","name":"Grok 3 Fast","type":"llm","endpoint":"grok-3-fast","active":true,"added_at":"2026-04-23"},
    {"id":"grok-2-image","name":"Grok 2 Image","type":"image","endpoint":"grok-2-image","active":true,"added_at":"2026-04-23"}
  ]'::jsonb)
ON CONFLICT (id) DO NOTHING;
