/**
 * Service-account auth for Drive (app side).
 *
 * Deliberately a copy of the worker's google/service-account.ts rather
 * than a shared package: the two deploy separately (Vercel and
 * Railway) and have no build-time link. Keep them in step.
 *
 * The OAuth path (google/refresh.ts) keeps breaking in ways that are
 * nobody's fault and nobody's job to fix: consent-screen scopes get
 * dropped, and an app left in "Testing" expires its refresh tokens
 * after seven days, which is what killed the connection made in May.
 *
 * A service account has none of that. It signs its own assertion with
 * a private key, needs no consent screen, and never expires. Its
 * access is exactly the set of folders somebody shared with its
 * email address, which is also tighter than the drive.readonly scope
 * it replaces (that one could read the entire Drive).
 */
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

type KeyFile = { client_email: string; private_key: string; project_id?: string };

let _key: KeyFile | null = null;
let _cached: { token: string; expiresAt: number } | null = null;

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

async function loadKey(): Promise<KeyFile> {
  if (_key) return _key;
  // Inline JSON (Railway) or a path (local). Inline wins.
  const inline = process.env.GOOGLE_SA_KEY_JSON;
  const path = process.env.GOOGLE_SA_KEY_FILE;
  const raw = inline ?? (path ? await readFile(path, 'utf8') : null);
  if (!raw) {
    throw new Error('set GOOGLE_SA_KEY_JSON or GOOGLE_SA_KEY_FILE');
  }
  const parsed = JSON.parse(raw) as KeyFile;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('service account key is missing client_email or private_key');
  }
  _key = parsed;
  return parsed;
}

/** True when a service-account key is configured at all. */
export function hasServiceAccount(): boolean {
  return !!(process.env.GOOGLE_SA_KEY_JSON || process.env.GOOGLE_SA_KEY_FILE);
}

export async function serviceAccountEmail(): Promise<string> {
  return (await loadKey()).client_email;
}

/**
 * A Google access token for the service account, cached until a
 * minute before it expires.
 */
export async function getServiceAccountToken(): Promise<string> {
  if (_cached && _cached.expiresAt > Date.now()) return _cached.token;

  const key = await loadKey();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  // Key files store the PEM with literal \n when they have been through
  // an env var, so normalise before signing.
  const pem = key.private_key.replace(/\\n/g, '\n');
  const assertion = `${header}.${claims}.${b64url(signer.sign(pem))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`service account token failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('no access_token returned');

  _cached = {
    token: json.access_token,
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000,
  };
  return _cached.token;
}
