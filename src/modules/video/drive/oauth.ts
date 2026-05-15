/**
 * Google Drive OAuth helpers.
 * Builds the consent URL, signs/verifies the CSRF state token, and
 * exchanges the auth code for access + refresh tokens. No network
 * dependencies beyond fetch().
 */
import { createHmac, randomBytes } from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'openid email https://www.googleapis.com/auth/drive.readonly';

export type GoogleTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
  id_token?: string;
};

export type GoogleIdPayload = { email?: string; sub?: string };

function signingKey(): string {
  const k = process.env.SESSION_SECRET;
  if (!k || k.length < 32) throw new Error('SESSION_SECRET required');
  return k;
}

export function makeState(orgId: string): string {
  const nonce = randomBytes(16).toString('hex');
  const ts = Date.now().toString();
  const payload = `${orgId}.${nonce}.${ts}`;
  const sig = createHmac('sha256', signingKey()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyState(
  state: string,
  maxAgeMs = 30 * 60 * 1000,
): { orgId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 4) return null;
    const [orgId, nonce, ts, sig] = parts;
    const payload = `${orgId}.${nonce}.${ts}`;
    const expected = createHmac('sha256', signingKey()).update(payload).digest('hex');
    if (sig !== expected) return null;
    if (Date.now() - parseInt(ts, 10) > maxAgeMs) return null;
    return { orgId };
  } catch {
    return null;
  }
}

export function buildConsentUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<GoogleTokens>;
}

/** Best-effort: decode the id_token to extract the user's Google email. */
export function decodeIdToken(idToken: string): GoogleIdPayload {
  try {
    const [, payloadB64] = idToken.split('.');
    if (!payloadB64) return {};
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
    return JSON.parse(json) as GoogleIdPayload;
  } catch {
    return {};
  }
}

export function getRedirectUri(req: Request): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}/api/video/oauth/google/callback`;
}

export const SCOPE_REQUIRED = SCOPE;
