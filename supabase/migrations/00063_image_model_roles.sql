-- ══════════════════════════════════════════════════════════════
-- 00063 - Model roles for the AI image tools
--
-- The role column is constrained to the text-and-vision roles from
-- 00049; generating and improving images are two new jobs with their
-- own model choice, so the constraint has to admit them.
--
-- Seeded with Nano Banana Pro (gemini-3-pro-image), which as of
-- 2026-Oct is the best available for this particular use. The
-- deciding capability is reference images: it takes up to 14 and
-- holds their lighting, palette and setting across a generation,
-- which is exactly "make this look like Anamaya" and is the thing
-- the alternatives specify least well. FLUX.2 takes 4 to 8 depending
-- on tier; GPT Image 2 barely documents its reference behaviour. It
-- also returns 4K, which matters because the library itself holds
-- only 1280px previews.
--
-- Here rather than in code so the choice can be changed without a
-- deploy when something better ships, which in this field is weeks.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE video_maker_model_roles
  DROP CONSTRAINT IF EXISTS video_maker_model_roles_role_check;

ALTER TABLE video_maker_model_roles
  ADD CONSTRAINT video_maker_model_roles_role_check
  CHECK (role = ANY (ARRAY[
    'vision', 'transcript', 'embed', 'script', 'edit', 'caption',
    'image_generate', 'image_enhance'
  ]));

INSERT INTO video_maker_model_roles (org_id, role, provider_id, model_endpoint, notes)
SELECT o.id, r.role, 'google', 'gemini-3-pro-image', r.notes
FROM organizations o
CROSS JOIN (VALUES
  ('image_generate',
   'Nano Banana Pro. Up to 14 reference images, held for lighting and '
   'setting; 1K/2K/4K out. About $0.13 at 2K, $0.24 at 4K.'),
  ('image_enhance',
   'Nano Banana Pro, image-to-image. Adds real detail rather than '
   'interpolating - the Enlarge tool stays lanczos for faithful blow-ups.')
) AS r(role, notes)
ON CONFLICT (org_id, role) DO NOTHING;
