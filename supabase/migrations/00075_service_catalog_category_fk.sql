-- 00075: service_catalog.category_id never had a foreign key, so API
-- queries that embed spa_categories (Reception Desk catalog) failed.
-- All existing rows point at spa_categories (checked 2026-11-22).
DO $$ BEGIN
  ALTER TABLE service_catalog
    ADD CONSTRAINT service_catalog_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES spa_categories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category_id);

NOTIFY pgrst, 'reload schema';
