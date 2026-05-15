import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  verifyState,
  exchangeCodeForTokens,
  decodeIdToken,
  getRedirectUri,
} from '@/modules/video/drive/oauth';
import { upsertConnection } from '@/modules/video/drive/connections';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(new URL(`/dashboard/video?oauth=denied`, url));
  }
  if (!code || !state) {
    return NextResponse.json({ error: 'missing code or state' }, { status: 400 });
  }

  const verified = verifyState(state);
  if (!verified) {
    return NextResponse.json({ error: 'invalid state' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'OAuth env not configured' }, { status: 500 });
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri: getRedirectUri(req),
    });
    const idPayload = tokens.id_token ? decodeIdToken(tokens.id_token) : {};
    const email = idPayload.email ?? 'unknown@google';

    await upsertConnection({
      orgId: verified.orgId,
      googleAccountEmail: email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      addedBy: session.user.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/dashboard/video?oauth=error&msg=${encodeURIComponent(msg)}`, url));
  }

  return NextResponse.redirect(new URL('/dashboard/video?oauth=connected', url));
}
