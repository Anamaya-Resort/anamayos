import { cookies } from 'next/headers';
import { getSession } from '@/lib/session';
import { storeMetaCredentials } from '@/lib/meta/graph';
import { discoverIgUserId } from '@/lib/meta/instagram';
import { OAUTH_STATE_COOKIE, exchangeCode, redirectUri } from '@/lib/meta/oauth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/meta/callback
 *
 * Where Meta sends the browser back after the login dialog. This exact
 * address is registered on the app, so it cannot move without being
 * re-registered there first.
 *
 * Ends by redirecting to the marketing dashboard with a short status in
 * the query string. Nothing about the token ever reaches the browser:
 * it is exchanged server side and written straight to the secrets
 * table, which no browser-facing role can read.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (status: string, detail?: string) => {
    const to = new URL('/smm_tracking', url.origin);
    to.searchParams.set('meta', status);
    if (detail) to.searchParams.set('detail', detail.slice(0, 160));
    return Response.redirect(to.toString(), 302);
  };

  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const denied = url.searchParams.get('error');
  if (denied) {
    return back('denied', url.searchParams.get('error_description') ?? denied);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return back('error', 'Meta sent no authorisation code.');

  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);
  if (!expected || expected !== state) {
    return back('error', 'That connection link had expired. Please start again.');
  }

  let token: string;
  try {
    ({ token } = await exchangeCode(code, redirectUri(request)));
  } catch (e) {
    return back('error', (e as Error).message);
  }

  let igUserId: string | null = null;
  try {
    igUserId = await discoverIgUserId(token);
  } catch {
    // The token is worth keeping even when discovery fails: the account
    // id can be filled in by hand in the connections panel.
  }

  await storeMetaCredentials(token, igUserId, session.personId ?? null);

  return back(igUserId ? 'connected' : 'needs-account-id');
}
