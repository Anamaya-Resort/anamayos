import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { crawlSource } from '@/modules/video/drive/crawl';
import { requestScan } from '@/modules/video/sources/queries';
import { getWorkerStatus } from '@/modules/video/worker-status';

// Only reachable on the offline-worker fallback below; the normal
// path returns in milliseconds.
export const maxDuration = 300;

/**
 * Queue a folder scan.
 *
 * This used to run the whole recursive crawl INLINE while the worker's
 * one-minute poller was independently claiming the same 'pending' row.
 * Two crawlers walked the same tree at once, racing on the same upsert,
 * and a large folder blew the serverless time limit and left the source
 * wedged on 'scanning' with no way to retry.
 *
 * Now there is exactly one owner: the worker. The app marks the source
 * pending and returns. The inline crawl survives only as an explicit
 * fallback for a confirmed-offline worker, so a dead worker degrades to
 * "slow, capped at 5 minutes" instead of "nothing happens, nobody says
 * why".
 */
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

  await requestScan(orgId, id);

  const worker = await getWorkerStatus();
  if (worker.online) {
    return NextResponse.json({ ok: true, queued: true, mode: 'worker' });
  }

  // No worker — crawl inline. Claim the row first so a worker that
  // comes back mid-crawl cannot start a second walk of the same tree.
  const { data: claimed } = await supabase
    .from('video_drive_sources')
    .update({ scan_status: 'scanning', scan_error: null })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('scan_status', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ ok: true, queued: true, mode: 'already_running' });
  }

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
    return NextResponse.json({ ok: true, total, mode: 'inline' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from('video_drive_sources')
      .update({ scan_status: 'error', scan_error: msg })
      .eq('id', id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
