/**
 * Server-side queries for video_drive_sources.
 */
import { createServiceClient } from '@/lib/supabase/server';

export type DriveSource = {
  id: string;
  org_id: string;
  connection_id: string;
  label: string;
  drive_kind: string;
  drive_folder_id: string;
  drive_id: string | null;
  watch_mode: string;
  is_active: boolean;
  last_scan_at: string | null;
  scan_status: string;
  scan_error: string | null;
  created_at: string;
};

export async function listSources(orgId: string): Promise<DriveSource[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('video_drive_sources')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data ?? []) as DriveSource[];
}

export async function createSource(opts: {
  orgId: string;
  connectionId: string;
  label: string;
  driveKind: string;
  driveFolderId: string;
  driveId: string | null;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('video_drive_sources')
    .upsert(
      {
        org_id: opts.orgId,
        connection_id: opts.connectionId,
        label: opts.label,
        drive_kind: opts.driveKind,
        drive_folder_id: opts.driveFolderId,
        drive_id: opts.driveId,
        watch_mode: 'on_demand',
        is_active: true,
        scan_status: 'pending',
      },
      { onConflict: 'org_id,drive_folder_id' },
    )
    .select('id')
    .single();
  if (error) throw new Error(`create source failed: ${error.message}`);
  return data.id;
}

/**
 * Queue a folder for (re)scanning.
 *
 * Deliberately unconditional. The old version only moved rows out of
 * 'idle' or 'error', so a source stuck in 'scanning' — which happens
 * whenever a crawl is interrupted, e.g. a serverless timeout or a
 * worker restart mid-crawl — could never be re-queued from the UI and
 * was wedged forever with no way out. Re-queuing is idempotent and
 * the crawl upserts, so making this always-allowed is safe.
 */
export async function requestScan(orgId: string, sourceId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('video_drive_sources')
    .update({ scan_status: 'pending', scan_error: null })
    .eq('id', sourceId)
    .eq('org_id', orgId);
  if (error) throw new Error(`request scan failed: ${error.message}`);
}

/** Per-source pipeline rollup for the sources list. */
export type SourceProgress = {
  total: number;
  proxied: number;
  tagged: number;
  failed: number;
};

/**
 * Per-source pipeline rollup, counted in the database.
 *
 * Not by fetching rows: PostgREST caps a response at 1000 rows
 * whatever limit is requested, so tallying in memory silently counted
 * a fraction of a large library and made scanned folders look
 * unprocessed.
 */
export async function sourceProgress(
  orgId: string,
): Promise<Record<string, SourceProgress>> {
  const supabase = createServiceClient();
  const { data: sources } = await supabase
    .from('video_drive_sources')
    .select('id')
    .eq('org_id', orgId);
  const ids = ((sources ?? []) as { id: string }[]).map((s) => s.id);

  const countFor = async (
    sourceId: string,
    col?: 'proxy_status' | 'analysis_status',
    value?: string,
  ) => {
    let qy = supabase
      .from('video_assets')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('source_id', sourceId)
      .eq('is_deleted_on_drive', false);
    if (col && value) qy = qy.eq(col, value);
    const { count } = await qy;
    return count ?? 0;
  };

  const out: Record<string, SourceProgress> = {};
  await Promise.all(
    ids.map(async (id) => {
      const [total, proxied, tagged, pxErr, anErr] = await Promise.all([
        countFor(id),
        countFor(id, 'proxy_status', 'done'),
        countFor(id, 'analysis_status', 'done'),
        countFor(id, 'proxy_status', 'error'),
        countFor(id, 'analysis_status', 'error'),
      ]);
      out[id] = { total, proxied, tagged, failed: pxErr + anErr };
    }),
  );
  return out;
}

export async function deleteSource(orgId: string, sourceId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('video_drive_sources')
    .delete()
    .eq('id', sourceId)
    .eq('org_id', orgId);
  if (error) throw new Error(`delete source failed: ${error.message}`);
}
