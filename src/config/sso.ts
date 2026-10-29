/**
 * LightningWorks SSO configuration.
 * All values come from environment variables — nothing hardcoded.
 */

export function getSSOConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SSO_URL ?? 'https://sso.lightningworks.io';
  const appSlug = process.env.NEXT_PUBLIC_SSO_APP_SLUG ?? 'anamayos';

  return { baseUrl, appSlug };
}

/** Build the SSO login redirect URL */
export function getSSOLoginUrl(callbackUrl: string): string {
  const { baseUrl, appSlug } = getSSOConfig();
  const params = new URLSearchParams({
    app: appSlug,
    redirect: callbackUrl,
  });
  return `${baseUrl}/login?${params.toString()}`;
}

/** SSO verify endpoint */
export function getSSOVerifyUrl(): string {
  const { baseUrl } = getSSOConfig();
  return `${baseUrl}/api/verify`;
}

/** Session cookie name */
export const SESSION_COOKIE = 'ao_session';

/** Session duration: 7 days in milliseconds */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Session duration in seconds (for cookie maxAge) */
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

/**
 * Validates a post-login destination. Only a same-site absolute path is
 * allowed: anything protocol-relative (`//evil.com`), backslash-tricked
 * (`/\evil.com`) or absolute (`https://…`) is rejected, so the `next`
 * parameter can never be used to bounce someone off the app.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
