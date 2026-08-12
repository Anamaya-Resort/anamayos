-- ============================================================
-- 00050: Retreat Guru push (PREPARED BUT DISABLED)
--
-- AnamayOS is becoming the place retreat data is authored, with
-- changes pushed outward to Retreat Guru. This migration adds the
-- storage for that, but nothing pushes yet: the per-retreat flag
-- defaults to false AND the server also requires the RG_PUSH_ENABLED
-- env var. Both must be on before a single byte leaves AO.
--
-- IMPORTANT LIMIT discovered from the Retreat Guru OpenAPI spec
-- (https://anamaya.secure.retreat.guru/api/v1/swagger.json):
--   * /lodgings is READ-ONLY — per-room prices cannot be written.
--   * /programs/{id}/update accepts `pricing_options` only as a flat
--     tiered array, and its own docs say "currently only `tiered` is
--     supported" for pricing_type.
-- So a retreat priced per-room (`pricing_type = 'lodging'`, which is
-- 148 of 156 rows today) can NEVER have its prices pushed without
-- converting it to tiered and destroying room-level booking. The push
-- code refuses that case outright; see src/lib/retreat-guru-push.ts.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- Per-retreat opt-in. Default OFF, deliberately.
ALTER TABLE retreats
  ADD COLUMN IF NOT EXISTS rg_push_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN retreats.rg_push_enabled IS
  'Opt-in: allow AO to push this retreat to Retreat Guru. Admin-only (L5+). Also gated by the RG_PUSH_ENABLED env var.';

-- Audit trail. Every attempt is logged, including dry runs, so we can
-- see exactly what would have been sent before anything is enabled.
CREATE TABLE IF NOT EXISTS rg_push_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_id   uuid REFERENCES retreats(id) ON DELETE SET NULL,
  rg_id        int,
  mode         text NOT NULL DEFAULT 'dry_run',   -- 'dry_run' | 'live'
  outcome      text NOT NULL,                     -- 'ok' | 'refused' | 'error'
  refused_reason text,
  fields_sent  text[] DEFAULT '{}',
  payload      jsonb DEFAULT '{}'::jsonb,
  response     jsonb DEFAULT '{}'::jsonb,
  pushed_by    uuid REFERENCES persons(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rg_push_log_retreat ON rg_push_log(retreat_id, created_at DESC);

ALTER TABLE rg_push_log ENABLE ROW LEVEL SECURITY;

-- Service role only. This log can contain pricing and capacity detail;
-- there is no reason for anon or the public website to read it.
DO $$ BEGIN
  CREATE POLICY "Service role full access" ON rg_push_log FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
