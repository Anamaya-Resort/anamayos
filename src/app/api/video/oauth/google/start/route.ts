import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { ACCESS_LEVELS } from '@/types';
import { buildConsentUrl, makeState, getRedirectUri } from '@/modules/video/drive/oauth';

function back(req: Request, msg: string) {
  const u = new URL('/dashboard/video', req.url);
  u.searchParams.set('oauth', 'error');
  u.searchParams.set('msg', msg.slice(0, 300));
  console.error(`[video-oauth] start failed: ${msg}`);
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return back(req, 'not signed in to AnamayOS — log in first');
  if (session.accessLevel < ACCESS_LEVELS.admin) {
    return back(req, 'admin access required to connect a Drive account');
  }

  const orgId = await getActiveOrgId();
  if (!orgId) return back(req, 'no organization found for your account');

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return back(req, 'GOOGLE_OAUTH_CLIENT_ID not configured');

  const redirectUri = getRedirectUri(req);
  const consent = buildConsentUrl({
    clientId,
    redirectUri,
    state: makeState(orgId),
  });
  console.log(`[video-oauth] start → redirect_uri=${redirectUri}`);
  return NextResponse.redirect(consent);
}
