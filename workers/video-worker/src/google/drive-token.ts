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
  if (hasServiceAccount()) return getServiceAccountToken();

  const hit = cache?.get(connectionId);
  if (hit) return hit;

  const { data: conn } = await db()
    .from('google_drive_connections')
    .select('oauth_refresh_enc, status')
    .eq('id', connectionId)
    .single();
  if (!conn) throw new Error('connection not found');
  if (conn.status !== 'active') throw new Error(`connection ${conn.status}`);

  const token = await refreshAccessToken(decryptToken(conn.oauth_refresh_enc));
  cache?.set(connectionId, token);
  return token;
}

/** Token for the connection behind a source id. */
export async function tokenForSource(
  sourceId: string,
  cache?: Map<string, string>,
): Promise<string> {
  if (hasServiceAccount()) return getServiceAccountToken();

  const { data: src } = await db()
    .from('video_drive_sources')
    .select('connection_id')
    .eq('id', sourceId)
    .single();
  if (!src) throw new Error('source not found');
  return tokenForConnection(src.connection_id as string, cache);
}
