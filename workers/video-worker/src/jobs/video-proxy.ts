/**
 * Video proxy job — the video counterpart of jobs/proxy.ts.
 * Claims pending VIDEO assets, streams the original from Drive to
 * disk, ffprobes it, transcodes a small H.264 mp4 proxy + a poster
 * still, uploads both, and records duration/dimensions.
 *
 * Separate from the image path on purpose: same proxy_status claim
 * model (so reclaimOrphanedProxies covers both), but ffmpeg-based
 * and one-at-a-time-ish since transcodes are heavy.
 */
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db } from '../db.js';
import { downloadDriveFileToPath } from '../google/download.js';
import { uploadProxy } from '../storage.js';
import { accessTokenForSource } from './proxy.js';
import { ffprobeMeta, transcodeProxy, extractFrame } from '../ffmpeg.js';
import { dbLog } from '../joblog.js';
import { log } from '../log.js';

type AssetRow = {
  id: string;
  org_id: string;
  drive_file_id: string;
  source_id: string;
  size_bytes: number | null;
};

const BATCH = 2;
// Bound per-video work so one giant file can't wedge the worker.
const MAX_BYTES = Number(process.env.VIDEO_MAX_BYTES ?? 2_000_000_000); // 2 GB

export async function processPendingVideos(): Promise<void> {
  const sb = db();

  const { data: candidates } = await sb
    .from('video_assets')
    .select('id, org_id, drive_file_id, source_id, size_bytes')
    .eq('proxy_status', 'pending')
    .eq('is_deleted_on_drive', false)
    .like('mime_type', 'video/%')
    .limit(BATCH);

  const rows = (candidates ?? []) as AssetRow[];
  if (rows.length === 0) return;

  const ids = rows.map((r) => r.id);
  const { data: claimed } = await sb
    .from('video_assets')
    .update({ proxy_status: 'processing', proxy_error: null })
    .in('id', ids)
    .eq('proxy_status', 'pending')
    .select('id');
  const claimedIds = new Set((claimed ?? []).map((r) => r.id));
  const mine = rows.filter((r) => claimedIds.has(r.id));
  if (mine.length === 0) return;

  await dbLog('info', `video proxy batch: ${mine.length} asset(s)`);
  const tokenByConn = new Map<string, string>();

  for (const a of mine) {
    const dir = await mkdtemp(join(tmpdir(), `vid-${a.id}-`));
    try {
      if (a.size_bytes && a.size_bytes > MAX_BYTES) {
        throw new Error(`video too large: ${a.size_bytes} bytes (cap ${MAX_BYTES})`);
      }
      const accessToken = await accessTokenForSource(sb, a.source_id, tokenByConn);
      const srcPath = join(dir, 'src');
      await downloadDriveFileToPath(accessToken, a.drive_file_id, srcPath);

      const meta = await ffprobeMeta(srcPath);
      const proxyFile = join(dir, 'proxy.mp4');
      const posterFile = join(dir, 'poster.webp');
      await transcodeProxy(srcPath, proxyFile);
      const posterAt = Math.min(1, meta.durationMs / 2000);
      await extractFrame(srcPath, posterFile, posterAt);

      const base = `${a.org_id}/${a.id}`;
      const proxyPath = await uploadProxy(
        `${base}/proxy.mp4`,
        await readFile(proxyFile),
        'video/mp4',
      );
      const posterPath = await uploadProxy(
        `${base}/poster.webp`,
        await readFile(posterFile),
        'image/webp',
      );

      await sb
        .from('video_assets')
        .update({
          proxy_path: proxyPath,
          thumb_path: posterPath,
          duration_ms: meta.durationMs || null,
          width: meta.width,
          height: meta.height,
          proxy_status: 'done',
        })
        .eq('id', a.id);

      await dbLog('info', 'video proxy complete', {
        assetId: a.id,
        durationMs: meta.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ assetId: a.id, err: msg }, 'video proxy failed');
      await dbLog('error', 'video proxy failed', { assetId: a.id, error: msg });
      await sb
        .from('video_assets')
        .update({ proxy_status: 'error', proxy_error: msg })
        .eq('id', a.id);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
