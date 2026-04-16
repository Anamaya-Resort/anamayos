-- ============================================================
-- Migration 00014: Room Layouts
-- Visual top-down room layouts with bed placements for admin builder
-- ============================================================

CREATE TABLE room_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  layout_json JSONB NOT NULL DEFAULT '{"shapes":[],"beds":[],"labels":[]}',
  unit TEXT NOT NULL DEFAULT 'meters' CHECK (unit IN ('meters', 'feet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_layouts_room ON room_layouts(room_id);

CREATE TRIGGER trg_room_layouts_updated_at
  BEFORE UPDATE ON room_layouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: any authenticated reads, admin+ writes
ALTER TABLE room_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_layouts_select ON room_layouts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY room_layouts_admin ON room_layouts
  FOR ALL TO authenticated
  USING (current_user_access_level() >= 5)
  WITH CHECK (current_user_access_level() >= 5);
