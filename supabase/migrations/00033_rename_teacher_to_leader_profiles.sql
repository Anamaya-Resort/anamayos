-- ============================================================
-- 00033: Rename teacher_profiles → retreat_leader_profiles
-- Not all retreat leaders are teachers.
-- ============================================================

ALTER TABLE teacher_profiles RENAME TO retreat_leader_profiles;

-- Indexes auto-rename with the table, but policies don't — recreate them
DROP POLICY IF EXISTS "Service role full access" ON retreat_leader_profiles;
DROP POLICY IF EXISTS "Anon read active" ON retreat_leader_profiles;

CREATE POLICY "Service role full access" ON retreat_leader_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read active" ON retreat_leader_profiles FOR SELECT USING (is_active = true);
