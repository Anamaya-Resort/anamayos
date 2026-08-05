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

export async function sourceProgress(
  orgId: string,
): Promise<Record<string, SourceProgress>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('video_assets')
    .select('source_id, proxy_status, analysis_status')
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false)
    .limit(100000);

  const out: Record<string, SourceProgress> = {};
  type Row = { source_id: string; proxy_status: string; analysis_status: string };
  for (const r of (data ?? []) as Row[]) {
    const p = (out[r.source_id] ??= { total: 0, proxied: 0, tagged: 0, failed: 0 });
    p.total++;
    if (r.proxy_status === 'done') p.proxied++;
    if (r.analysis_status === 'done') p.tagged++;
    if (r.proxy_status === 'error' || r.analysis_status === 'error') p.failed++;
  }
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
