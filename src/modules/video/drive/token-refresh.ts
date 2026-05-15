/**
 * Server-side: fetch a fresh Drive access token for a connection.
 * Decrypts the stored refresh token, exchanges it at Google, returns
 * a short-lived access token. Used by the Picker-token endpoint so
 * the client-side Google Picker can authenticate without ever seeing
 * the long-lived refresh token.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { decryptToken } from './crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function getAccessTokenForConnection(
  orgId: string,
  connectionId: string,
): Promise<string> {
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
  return json.access_token;
}
