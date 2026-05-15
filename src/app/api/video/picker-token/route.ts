import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { ACCESS_LEVELS } from '@/types';
import { getAccessTokenForConnection } from '@/modules/video/drive/token-refresh';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.accessLevel < ACCESS_LEVELS.admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const connectionId = new URL(req.url).searchParams.get('connectionId');
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
  }

  try {
    const accessToken = await getAccessTokenForConnection(orgId, connectionId);
    return NextResponse.json({ accessToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
