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

export async function requestScan(orgId: string, sourceId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('video_drive_sources')
    .update({ scan_status: 'pending', scan_error: null })
    .eq('id', sourceId)
    .eq('org_id', orgId)
    .in('scan_status', ['idle', 'error']);
  if (error) throw new Error(`request scan failed: ${error.message}`);
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
