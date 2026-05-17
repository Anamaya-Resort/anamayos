import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { crawlSource } from '@/modules/video/drive/crawl';

// Inventory crawl is metadata-only but a big tree can take a while.
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: src, error: srcErr } = await supabase
    .from('video_drive_sources')
    .select('id, connection_id, drive_folder_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();
  if (srcErr || !src) {
    return NextResponse.json({ error: 'source not found' }, { status: 404 });
  }

  await supabase
    .from('video_drive_sources')
    .update({ scan_status: 'scanning', scan_error: null })
    .eq('id', id)
    .eq('org_id', orgId);

  try {
    const { total } = await crawlSource({
      orgId,
      sourceId: id,
      connectionId: src.connection_id,
      rootFolderId: src.drive_folder_id,
    });
    await supabase
      .from('video_drive_sources')
      .update({ scan_status: 'idle', last_scan_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ ok: true, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from('video_drive_sources')
      .update({ scan_status: 'error', scan_error: msg })
      .eq('id', id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
