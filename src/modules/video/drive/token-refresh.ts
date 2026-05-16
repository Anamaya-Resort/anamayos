/**
 * Server-side: fetch a fresh Drive access token for a connection.
 * Cached in-memory per connection so folder browsing doesn't
 * re-authenticate with Google on every click (that was the lag).
 * Google access tokens last ~3600s; we cache for 50 min.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { decryptToken } from './crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const cache = new Map<string, { token: string; exp: number }>();
const TTL_MS = 50 * 60 * 1000;

export async function getAccessTokenForConnection(
  orgId: string,
  connectionId: string,
): Promise<string> {
  const key = `${orgId}:${connectionId}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.token;

  const supabase = createServiceClient();
  const { data: conn, error } = await supabase
    .from('google_drive_connections')
    .select('oauth_refresh_enc, status, org_id')
    .eq('id', connectionId)
    .eq('org_id', orgId)
    .single();
  if (error || !conn) throw new Error('connection not found');
  if (conn.status !== 'active') throw new Error(`connection ${conn.status}`);

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('OAuth env not configured');

  const refreshToken = decryptToken(conn.oauth_refresh_enc);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('no access_token returned');

  cache.set(key, { token: json.access_token, exp: Date.now() + TTL_MS });
  return json.access_token;
}
