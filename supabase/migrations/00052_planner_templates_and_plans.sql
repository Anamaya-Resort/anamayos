-- ============================================================
-- Migration 00052: Experience Planner persistence
-- Reusable day-program TEMPLATES + per-retreat EXPERIENCE PLANS
--
-- planner_templates : date-agnostic daily-recurring programs (e.g. the
--                     house "Standard Day"). `events` is a JSON array of
--                     TEMPLATE events { id, kind, title, startMin,
--                     durationMin, description?, plan?, layer? }.
-- experience_plans  : one materialised, dated plan per retreat. `events`
--                     is a JSON array of dated PLAN events (PlannerEvent).
--
-- RLS mirrors retreats/products: any authenticated user reads, staff+
-- (access level >= 3) writes. All AO API access goes through the service
-- client, which bypasses RLS; policies are the defence-in-depth floor.
-- ============================================================

-- ============================================================
-- 1. PLANNER TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS planner_templates (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  events       JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_standard  BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES persons(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one standard template (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_templates_one_standard
  ON planner_templates (is_standard) WHERE is_standard;

-- ============================================================
-- 2. EXPERIENCE PLANS (one per retreat)
-- ============================================================

CREATE TABLE IF NOT EXISTS experience_plans (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  retreat_id         UUID NOT NULL UNIQUE REFERENCES retreats(id) ON DELETE CASCADE,
  name               TEXT,
  events             JSONB NOT NULL DEFAULT '[]'::JSONB,
  source_template_id UUID REFERENCES planner_templates(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'draft',
  created_by         UUID REFERENCES persons(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experience_plans_retreat
  ON experience_plans (retreat_id);

-- ============================================================
-- 3. updated_at TRIGGERS (reuse shared update_updated_at())
-- ============================================================

DROP TRIGGER IF EXISTS trg_planner_templates_updated_at ON planner_templates;
CREATE TRIGGER trg_planner_templates_updated_at
  BEFORE UPDATE ON planner_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_experience_plans_updated_at ON experience_plans;
CREATE TRIGGER trg_experience_plans_updated_at
  BEFORE UPDATE ON experience_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE planner_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_plans ENABLE ROW LEVEL SECURITY;

-- Templates: any authenticated reads, staff+ writes
DROP POLICY IF EXISTS planner_templates_select ON planner_templates;
CREATE POLICY planner_templates_select ON planner_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS planner_templates_staff ON planner_templates;
CREATE POLICY planner_templates_staff ON planner_templates
  FOR ALL TO authenticated
  USING (current_user_access_level() >= 3)
  WITH CHECK (current_user_access_level() >= 3);

-- Experience plans: any authenticated reads, staff+ writes
DROP POLICY IF EXISTS experience_plans_select ON experience_plans;
CREATE POLICY experience_plans_select ON experience_plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS experience_plans_staff ON experience_plans;
CREATE POLICY experience_plans_staff ON experience_plans
  FOR ALL TO authenticated
  USING (current_user_access_level() >= 3)
  WITH CHECK (current_user_access_level() >= 3);

-- ============================================================
-- 5. SEED — one standard template ("Anamaya Standard Day")
-- Events mirror src/modules/planner/default-schedule.ts (DEFAULT_SCHEDULE).
-- Fixed id + ON CONFLICT DO NOTHING keeps this idempotent.
-- Times are minutes-from-midnight; durationMin = end - start.
-- ============================================================

INSERT INTO planner_templates (id, name, description, is_standard, events)
VALUES (
  '00000000-0000-4000-a000-0000000005ed',
  'Anamaya Standard Day',
  'The default daily program — morning & evening yoga plus meals. Applied to every day of a retreat unless overridden.',
  true,
  '[
    {"id":"morning-yoga","kind":"yoga","title":"Morning Yoga","startMin":420,"durationMin":90,"layer":"program"},
    {"id":"breakfast","kind":"meal","title":"Breakfast","startMin":510,"durationMin":60,"layer":"program"},
    {"id":"lunch","kind":"meal","title":"Lunch","startMin":780,"durationMin":60,"layer":"program"},
    {"id":"evening-yoga","kind":"yoga","title":"Evening Yoga","startMin":990,"durationMin":90,"layer":"program"},
    {"id":"dinner","kind":"meal","title":"Dinner","startMin":1110,"durationMin":60,"layer":"program"}
  ]'::JSONB
)
ON CONFLICT (id) DO NOTHING;
