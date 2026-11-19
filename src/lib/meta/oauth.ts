import 'server-only';
import { randomBytes } from 'node:crypto';
import { GRAPH_VERSION } from './graph';

/**
 * The Facebook Login handshake that mints a reporting token.
 *
 * The app itself lives on the LightningWorks portfolio while the
 * Instagram account lives on Anamaya's, which is why this is a login
 * configuration ("Unified Login") rather than a plain scope list: the
 * configuration is what carries the agreed permissions across the two.
 *
 * The ids below are not secrets -- the app id travels in every dialog
 * URL -- but they are env-overridable so a second deployment can point
 * at a different app without a code change. The app SECRET is env-only
 * and never falls back to anything.
 */

/** "AnamayaOS Reporting". */
const DEFAULT_APP_ID = '3756136297869867';

/** The "Instagram API (Unified Login)" configuration on that app. */
const DEFAULT_CONFIG_ID = '1617678249404028';

export const META_APP_ID = process.env.META_APP_ID ?? DEFAULT_APP_ID;
export const META_CONFIG_ID = process.env.META_LOGIN_CONFIG_ID ?? DEFAULT_CONFIG_ID;

export const OAUTH_STATE_COOKIE = 'meta_oauth_state';

/**
 * Must match a redirect URL registered on the app character for
 * character, or Meta rejects the exchange rather than the dialog, which
 * makes the mismatch look like a server fault instead of a typo.
 */
export function redirectUri(request: Request): string {
  const override = process.env.META_REDIRECT_URI;
  if (override) return override;
  return new URL('/api/meta/callback', new URL(request.url).origin).toString();
}

export function newState(): string {
  return randomBytes(24).toString('hex');
}

export function dialogUrl(state: string, redirect: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', META_APP_ID);
  url.searchParams.set('config_id', META_CONFIG_ID);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Trades the dialog's code for a token that outlives the browser session.
 *
 * Two calls, not one: the code buys a short-lived token good for about
 * an hour, and only that token can be exchanged for the long-lived one
 * a nightly sync needs. Skipping the second call produces a connector
 * that works all afternoon and is broken by morning.
 */
export async function exchangeCode(
  code: string, redirect: string,
): Promise<{ token: string; expiresIn: number | null }> {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    throw new Error(
      'META_APP_SECRET is not set, so the code cannot be exchanged for a token.',
    );
  }

  const short = await tokenCall({
    client_id: META_APP_ID,
    client_secret: secret,
    redirect_uri: redirect,
    code,
  });

  const long = await tokenCall({
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: secret,
    fb_exchange_token: short.token,
  }).catch(() => null);

  return long ?? short;
}

async function tokenCall(
  params: Record<string, string>,
): Promise<{ token: string; expiresIn: number | null }> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string; expires_in?: number; error?: { message?: string };
  };

  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message ?? `Token exchange failed (${res.status})`);
  }
  return { token: json.access_token, expiresIn: json.expires_in ?? null };
}
