-- ══════════════════════════════════════════════════════════════
-- 00050 - Let a Drive connection be a service account
--
-- The OAuth path proved unmaintainable in practice: the consent
-- screen dropped the drive.readonly scope, and an app left in
-- "Testing" expires refresh tokens after seven days, which silently
-- killed the connection made in May. Neither failure surfaced
-- anywhere; the UI still showed the account as Active.
--
-- A service account signs its own assertion, needs no consent screen
-- and never expires. Its reach is exactly the folders shared with its
-- address, which is narrower than the drive.readonly scope it
-- replaces.
--
-- Modelled as a connection row so the existing UI, the folder picker
-- and video_drive_sources.connection_id all keep working unchanged.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE google_drive_connections
  ADD COLUMN IF NOT EXISTS auth_mode text NOT NULL DEFAULT 'oauth'
    CHECK (auth_mode IN ('oauth', 'service_account'));

-- A service account has no OAuth tokens to store. These columns are
-- NOT NULL from 00041, so drop that rather than write fake ciphertext.
ALTER TABLE google_drive_connections
  ALTER COLUMN oauth_access_enc DROP NOT NULL,
  ALTER COLUMN oauth_refresh_enc DROP NOT NULL;

COMMENT ON COLUMN google_drive_connections.auth_mode IS
  'oauth = per-user refresh token in oauth_*_enc. service_account = signed by the key in GOOGLE_SA_KEY_JSON/FILE; token columns are null.';

-- The service account for this deployment. Folders must be shared
-- with this address in Drive before it can see them.
INSERT INTO google_drive_connections
  (org_id, google_account_email, oauth_scope, status, auth_mode,
   oauth_access_enc, oauth_refresh_enc)
SELECT id,
       'anamaya-media@anamayos.iam.gserviceaccount.com',
       'https://www.googleapis.com/auth/drive.readonly',
       'active',
       'service_account',
       NULL, NULL
FROM organizations
ON CONFLICT (org_id, google_account_email) DO UPDATE
  SET status = 'active', auth_mode = 'service_account';

-- The dead OAuth connection: mark it, don't delete it. It still owns
-- video_drive_sources rows, and deleting it would cascade away the
-- 59 assets already scanned and reviewed.
UPDATE google_drive_connections
SET status = 'expired',
    last_error = 'Refresh token rejected (invalid_grant). Superseded by the service account.'
WHERE auth_mode = 'oauth'
  AND google_account_email = 'anamayavisuals@gmail.com';
