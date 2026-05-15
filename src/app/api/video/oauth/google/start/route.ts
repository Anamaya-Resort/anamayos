import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { ACCESS_LEVELS } from '@/types';
import { buildConsentUrl, makeState, getRedirectUri } from '@/modules/video/drive/oauth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.accessLevel < ACCESS_LEVELS.admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_OAUTH_CLIENT_ID not configured' }, { status: 500 });
  }

  const url = buildConsentUrl({
    clientId,
    redirectUri: getRedirectUri(req),
    state: makeState(orgId),
  });
  return NextResponse.redirect(url);
}
