-- ══════════════════════════════════════════════════════════════
-- 00060 - Close the video module's RLS policies to the service role
--
-- Every video_* table carried a policy named "Service role full
-- access" written as:
--
--   CREATE POLICY ... FOR ALL USING (true) WITH CHECK (true);
--
-- with no TO clause. A policy with no TO clause applies to PUBLIC,
-- and PUBLIC includes anon and authenticated. Policies are OR'd, so
-- that one clause granted anybody holding the anon key full SELECT,
-- INSERT, UPDATE and DELETE on the entire image library - the
-- opposite of what the name says, and it silently overrode the
-- careful "published galleries only" policies added in 00053 and
-- 00059, which is how it was found: anon could read 200 assets when
-- exactly 5 were in the one published gallery.
--
-- The policies were never needed. The service role bypasses RLS
-- entirely in Supabase, so it reaches these tables with or without a
-- policy. Dropping them removes the grant to anon and changes nothing
-- for the app, which talks to this database with the service key on
-- the server and has no browser Supabase client at all.
--
-- What remains: the three anon SELECT policies, which is the whole
-- public surface - a published gallery, its membership, and the
-- photographs in it.
--
-- NOTE: the same pattern is on ~55 non-video tables in this database,
-- including guests, bookings and folios. Those are outside this
-- module and are left alone here; they need the same treatment.
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'Service role full access'
      AND roles::text = '{public}'
      AND cmd = 'ALL'
      AND qual = 'true'
      AND tablename LIKE 'video%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Service role full access', t);
  END LOOP;
END $$;
