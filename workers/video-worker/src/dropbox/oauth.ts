/**
 * Dropbox OAuth with a refresh token.
 *
 * The generated tokens in the App Console expire after about four
 * hours, which is fine for a one-off and useless for anything
 * ongoing: an import that runs longer than its own credential fails
 * halfway, twice now. A refresh token does not expire, and an access
 * token is minted from it on demand.
 *
 * Uses PKCE, so only the app KEY is needed and the app SECRET never
 * has to leave the Dropbox console or live in an environment
 * variable. The key is not a secret - it appears in the authorize URL
 * the browser visits.
 */
import { createHash, randomBytes } from 'node:crypto';

const AUTH = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';

export function makeVerifier(): string {
  // 43-128 chars of unreserved characters, per RFC 7636.
  return randomBytes(64).toString('base64url').slice(0, 128);
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * The URL the user opens. No redirect_uri, so Dropbox shows the code
 * on screen to paste back rather than needing a callback server.
 */
export function authorizeUrl(appKey: string, verifier: string): string {
  const p = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    // Without this Dropbox returns a short-lived token and no refresh
    // token, which is the whole problem being solved here.
    token_access_type: 'offline',
    code_challenge: challengeFor(verifier),
    code_challenge_method: 'S256',
  });
  return `${AUTH}?${p.toString()}`;
}

export async function exchangeCode(opts: {
  appKey: string;
  verifier: string;
  code: string;
}): Promise<{ refreshToken: string; accessToken: string }> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code.trim(),
      grant_type: 'authorization_code',
      client_id: opts.appKey,
      code_verifier: opts.verifier,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`dropbox token exchange failed: ${res.status} ${text.slice(0, 300)}`);
  const j = JSON.parse(text) as { refresh_token?: string; access_token?: string };
  if (!j.refresh_token) {
    throw new Error('no refresh_token returned - was token_access_type=offline used?');
  }
  return { refreshToken: j.refresh_token, accessToken: j.access_token ?? '' };
}

let cached: { token: string; expiresAt: number } | null = null;

/**
 * A live access token, minted from the refresh token and cached until
 * shortly before it lapses.
 */
export async function accessTokenFromRefresh(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const refresh = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  if (!refresh || !appKey) {
    throw new Error('DROPBOX_REFRESH_TOKEN and DROPBOX_APP_KEY are required');
  }

  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: appKey,
    }),
  });
  if (!res.ok) {
    throw new Error(`dropbox refresh failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('no access_token from refresh');

  cached = {
    token: j.access_token,
    // A minute early, so a long download never races the expiry.
    expiresAt: Date.now() + ((j.expires_in ?? 14400) - 60) * 1000,
  };
  return cached.token;
}

export function hasRefreshToken(): boolean {
  return !!(process.env.DROPBOX_REFRESH_TOKEN && process.env.DROPBOX_APP_KEY);
}
