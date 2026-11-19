import { cookies } from 'next/headers';
import { getSession } from '@/lib/session';
import { OAUTH_STATE_COOKIE, dialogUrl, newState, redirectUri } from '@/lib/meta/oauth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/meta/connect
 *
 * Starts the Instagram connection. An admin opens this and lands back
 * on the marketing dashboard with a token saved, or with a message
 * saying why not.
 *
 * The random state is held in an httpOnly cookie and checked on the way
 * back, so a link someone else crafted cannot bind a different
 * Instagram account to this install.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const state = newState();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return Response.redirect(dialogUrl(state, redirectUri(request)), 302);
}
