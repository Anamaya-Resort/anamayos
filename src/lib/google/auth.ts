import 'server-only';
import { createSign } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Google service-account auth for the GA4 Data API and Search Console.
 *
 * The key lives in `marketing_secrets` rather than an env var so it can be
 * rotated from the gear without a redeploy, and because that table is
 * service-role only — the browser cannot read it.
 *
 * Tokens are cached in module scope for their lifetime: a dashboard render
 * makes several Google calls and there is no reason to mint a JWT per call.
 */
interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const cache = new Map<string, { token: string; expiresAt: number }>();
let accountPromise: Promise<ServiceAccount | null> | null = null;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function loadAccount(): Promise<ServiceAccount | null> {
  // Env var wins when present, so a deployment can override the stored key.
  const fromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as ServiceAccount;
    } catch {
      return null;
    }
  }

  const sb = createServiceClient();
  const { data } = await sb
    .from('marketing_secrets')
    .select('secret_value')
    .eq('platform_key', 'google_analytics')
    .eq('secret_key', 'service_account_json')
    .maybeSingle();

  if (!data?.secret_value) return null;
  try {
    const parsed = JSON.parse(data.secret_value as string) as ServiceAccount;
    return parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

/** True when a Google credential is available at all. */
export async function hasGoogleCredential(): Promise<boolean> {
  accountPromise ??= loadAccount();
  return (await accountPromise) !== null;
}

/**
 * An OAuth access token for one scope, or null when no credential is
 * configured. Callers treat null as "not connected", never as an error.
 */
export async function getGoogleToken(scope: string): Promise<string | null> {
  const hit = cache.get(scope);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;

  accountPromise ??= loadAccount();
  const account = await accountPromise;
  if (!account) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: account.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(account.private_key));
  const assertion = `${header}.${claims}.${signature}`;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cache.set(scope, {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    });
    return json.access_token;
  } catch {
    return null;
  }
}

export const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
