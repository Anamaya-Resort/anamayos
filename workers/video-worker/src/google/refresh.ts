/**
 * Exchange a Drive refresh token for a fresh access token.
 * Google refresh tokens are long-lived and reusable; access tokens
 * last ~1 hour. We refresh before each crawl rather than tracking
 * expiry — crawls are infrequent and a refresh call is cheap.
 */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / SECRET required');
  }
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
    const text = await res.text();
    throw new Error(`token refresh failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('token refresh returned no access_token');
  return json.access_token;
}
