import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { ACCESS_LEVELS } from '@/types';
import { listDriveFolders } from '@/modules/video/drive/list-folders';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.accessLevel < ACCESS_LEVELS.admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  const connectionId = sp.get('connectionId');
  const parentId = sp.get('parentId') || 'root';
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
  }

  try {
    const folders = await listDriveFolders({ orgId, connectionId, parentId });
    return NextResponse.json({ folders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
