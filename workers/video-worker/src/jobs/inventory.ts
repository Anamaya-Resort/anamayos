/**
 * Claims pending Drive sources and inventories them.
 * Claim pattern: UPDATE ... WHERE scan_status='pending' so two
 * worker ticks can't process the same source twice.
 */
import { db } from '../db.js';
import { decryptToken } from '../crypto.js';
import { refreshAccessToken } from '../google/refresh.js';
import { crawlFolder, type DriveFile } from '../google/drive.js';
import { log } from '../log.js';
import { dbLog } from '../joblog.js';

type SourceRow = {
  id: string;
  org_id: string;
  connection_id: string;
  drive_folder_id: string;
  drive_id: string | null;
};

export async function scanPendingSources(): Promise<void> {
  const sb = db();
  const { data: pending } = await sb
    .from('video_drive_sources')
    .select('id, org_id, connection_id, drive_folder_id, drive_id')
    .eq('scan_status', 'pending')
    .eq('is_active', true)
    .limit(5);

  const count = pending?.length ?? 0;
  if (count > 0) {
    await dbLog('info', `scan tick: ${count} pending source(s)`);
  }

  for (const src of (pending ?? []) as SourceRow[]) {
    // Claim it — only proceed if we won the race.
    const { data: claimed } = await sb
      .from('video_drive_sources')
      .update({ scan_status: 'scanning', scan_error: null })
      .eq('id', src.id)
      .eq('scan_status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    await dbLog('info', 'claimed source for inventory', { sourceId: src.id });

    try {
      await inventorySource(src);
      await sb
        .from('video_drive_sources')
        .update({ scan_status: 'idle', last_scan_at: new Date().toISOString() })
        .eq('id', src.id);
      await dbLog('info', 'inventory complete', { sourceId: src.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ sourceId: src.id, err: msg }, 'inventory failed');
      await dbLog('error', 'inventory failed', { sourceId: src.id, error: msg });
      await sb
        .from('video_drive_sources')
        .update({ scan_status: 'error', scan_error: msg })
        .eq('id', src.id);
    }
  }
}

async function inventorySource(src: SourceRow): Promise<void> {
  const sb = db();
  const { data: conn } = await sb
    .from('google_drive_connections')
    .select('oauth_refresh_enc, status')
    .eq('id', src.connection_id)
    .single();
  if (!conn) throw new Error('connection not found');
  if (conn.status !== 'active') throw new Error(`connection status is ${conn.status}`);

  const refreshToken = decryptToken(conn.oauth_refresh_enc);
  const accessToken = await refreshAccessToken(refreshToken);

  const { total } = await crawlFolder({
    accessToken,
    rootFolderId: src.drive_folder_id,
    driveId: src.drive_id,
    onBatch: (files) => upsertAssets(src, files),
  });
  log.info({ sourceId: src.id, total }, 'inventory complete');
}

async function upsertAssets(src: SourceRow, files: DriveFile[]): Promise<void> {
  const sb = db();
  const rows = files.map((f) => ({
    org_id: src.org_id,
    source_id: src.id,
    drive_file_id: f.driveFileId,
    drive_path: f.path,
    drive_md5_checksum: f.md5,
    mime_type: f.mimeType,
    file_name: f.name,
    size_bytes: f.sizeBytes,
    duration_ms: f.durationMs,
    width: f.width,
    height: f.height,
    captured_at: f.capturedAt,
    analysis_status: 'pending',
  }));
  const { error } = await sb
    .from('video_assets')
    .upsert(rows, { onConflict: 'source_id,drive_file_id', ignoreDuplicates: false });
  if (error) throw new Error(`asset upsert failed: ${error.message}`);
}
