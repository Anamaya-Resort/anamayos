import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  verifyState,
  exchangeCodeForTokens,
  decodeIdToken,
  getRedirectUri,
} from '@/modules/video/drive/oauth';
import { upsertConnection } from '@/modules/video/drive/connections';

function back(req: Request, reason: string, msg?: string) {
  const u = new URL('/dashboard/video', req.url);
  u.searchParams.set('oauth', reason);
  if (msg) u.searchParams.set('msg', msg.slice(0, 300));
  console.error(`[video-oauth] callback failed: ${reason}${msg ? ` — ${msg}` : ''}`);
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return back(req, 'error', 'not signed in to AnamayOS — log in first');

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) return back(req, 'denied', oauthError);
  if (!code || !state) return back(req, 'error', 'missing code or state from Google');

  const verified = verifyState(state);
  if (!verified) return back(req, 'error', 'state expired or invalid — click Connect again');

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return back(req, 'error', 'OAuth env not configured');

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri: getRedirectUri(req),
    });
    if (!tokens.refresh_token) {
      return back(
        req,
        'error',
        'Google returned no refresh token — revoke the app at myaccount.google.com/permissions and retry',
      );
    }
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
    console.log(`[video-oauth] connected ${email} for org ${verified.orgId}`);
  } catch (err) {
    return back(req, 'error', err instanceof Error ? err.message : String(err));
  }

  return NextResponse.redirect(new URL('/dashboard/video?oauth=connected', req.url));
}
