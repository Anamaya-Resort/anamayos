-- AO Platform: Add missing unique constraint for person_roles upsert
-- Migration 00007

-- Required for upsert onConflict: 'person_id,role_id' to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_person_roles_person_role_unique
  ON person_roles(person_id, role_id);
