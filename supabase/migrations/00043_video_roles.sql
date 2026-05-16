-- ============================================================
-- 00043: Visuals roles for the Video Maker module
-- ============================================================
-- Two scoped roles so people can work on visuals without holding
-- a full org-admin role:
--
--   visuals_manager  — admin-type rights over the visuals section
--                      (connect Drives, manage sources/models,
--                      review media). NOT org admin.
--   visuals_creative — create/edit video projects; cannot manage
--                      Drive connections, models, or other people's
--                      projects.
--
-- Low access_level (2) on purpose: these roles must NOT unlock
-- unrelated staff/manager/admin sections. Visuals powers are
-- granted explicitly by role slug in the Video Maker code + nav,
-- not by the numeric level.
-- ============================================================

INSERT INTO roles (id, slug, name, description, category, access_level, is_active, sort_order)
SELECT gen_random_uuid(), 'visuals_manager', 'Visuals Manager',
       'Admin access to the Video Maker / visuals section: connect Google Drives, manage sources and AI models, review and approve media. Not an organization admin.',
       'staff_admin', 2, true, 60
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'visuals_manager');

INSERT INTO roles (id, slug, name, description, category, access_level, is_active, sort_order)
SELECT gen_random_uuid(), 'visuals_creative', 'Visuals Creative',
       'Create and edit video projects. Cannot manage Drive connections, AI models, or other people''s projects.',
       'staff_admin', 2, true, 61
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'visuals_creative');
