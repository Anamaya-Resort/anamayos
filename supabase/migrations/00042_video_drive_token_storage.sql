-- ============================================================
-- 00042: switch Drive OAuth token storage from Vault uuids to
-- encrypted text columns.
-- ============================================================
-- The original 00041 design used Supabase Vault (uuid FKs into
-- vault.secrets). In practice Vault is only callable via RPC
-- wrappers, which is more plumbing than this feature needs. We
-- instead encrypt the tokens in Node (AES-256-GCM, key derived
-- from SESSION_SECRET) and store the base64 ciphertext as text.
-- Both the Next.js app and the Railway worker can encrypt/decrypt
-- as long as they share SESSION_SECRET.
--
-- Safe because no rows exist yet — the OAuth flow ships in Slice 1.
-- ============================================================

ALTER TABLE google_drive_connections
  DROP COLUMN IF EXISTS oauth_access_secret_id,
  DROP COLUMN IF EXISTS oauth_refresh_secret_id,
  ADD COLUMN IF NOT EXISTS oauth_access_enc text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS oauth_refresh_enc text NOT NULL DEFAULT '';

-- Remove the temporary defaults — required only because the columns
-- were added NOT NULL on existing rows (there are none, but Postgres
-- still demands a default at creation time).
ALTER TABLE google_drive_connections
  ALTER COLUMN oauth_access_enc DROP DEFAULT,
  ALTER COLUMN oauth_refresh_enc DROP DEFAULT;
