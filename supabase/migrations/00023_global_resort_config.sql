-- Global resort config — shared across all room layouts
-- Stored as a single row in a simple key-value table
CREATE TABLE IF NOT EXISTS resort_config (
  id text PRIMARY KEY DEFAULT 'default',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE resort_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON resort_config FOR ALL USING (true) WITH CHECK (true);
