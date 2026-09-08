/**
 * One place that answers "what token do I use to read Drive".
 *
 * Prefers the service account when a key is configured, because it
 * never expires. Falls back to the stored per-connection OAuth refresh
 * token so existing connections keep working.
 */
import { db } from '../db.js';
import { decryptToken } from '../crypto.js';
import { refreshAccessToken } from './refresh.js';
import { hasServiceAccount, getServiceAccountToken } from './service-account.js';

/** Token for a given source's connection, cached per connection id. */
export async function tokenForConnection(
  connectionId: string,
  cache?: Map<string, string>,
): Promise<string> {
  const hit = cache?.get(connectionId);
  if (hit) return hit;

  const { data: conn } = await db()
    .from('google_drive_connections')
    .select('oauth_refresh_enc, status, auth_mode, google_account_email')
    .eq('id', connectionId)
    .single();
  if (!conn) throw new Error('connection not found');
  if (conn.status !== 'active') throw new Error(`connection ${conn.status}`);

  // The connection row decides, not a global env check. When the row
  // says service_account and the key is absent, say exactly that -
  // previously this fell through to the OAuth branch and died on a
  // null token with an error that named neither cause nor fix.
  if (conn.auth_mode === 'service_account') {
    if (!hasServiceAccount()) {
      throw new Error(
        `connection ${conn.google_account_email} is a service account, but neither ` +
          'GOOGLE_SA_KEY_JSON nor GOOGLE_SA_KEY_FILE is set on this worker. ' +
          'Add the key to the worker environment and redeploy.',
      );
    }
    return getServiceAccountToken();
  }

  const token = await refreshAccessToken(decryptToken(conn.oauth_refresh_enc));
  cache?.set(connectionId, token);
  return token;
}

/** Token for the connection behind a source id. */
export async function tokenForSource(
  sourceId: string,
  cache?: Map<string, string>,
): Promise<string> {
  const { data: src } = await db()
    .from('video_drive_sources')
    .select('connection_id')
    .eq('id', sourceId)
    .single();
  if (!src) throw new Error('source not found');
  return tokenForConnection(src.connection_id as string, cache);
}
