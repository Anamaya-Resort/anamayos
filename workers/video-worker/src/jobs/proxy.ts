/**
 * Generate thumbnails + 1280px proxies for inventoried image assets,
 * perceptual-hash them, upload to video-proxies, and flag exact
 * duplicates. Claim-safe batch loop via proxy_status.
 *
 * Images only for now (the real data is all images). Video proxy
 * generation (ffmpeg) is a follow-up within Slice 2.
 */
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { db } from '../db.js';

// sharp-phash is CommonJS — load via require to avoid ESM interop
// resolving it to a non-callable namespace.
const require = createRequire(import.meta.url);
const phash = require('sharp-phash') as (input: Buffer) => Promise<string>;
import { decryptToken } from '../crypto.js';
import { refreshAccessToken } from '../google/refresh.js';
import { downloadDriveFile } from '../google/download.js';
import { uploadProxy } from '../storage.js';
import { dbLog } from '../joblog.js';
import { log } from '../log.js';

type AssetRow = {
  id: string;
  org_id: string;
  drive_file_id: string;
  drive_md5_checksum: string | null;
  source_id: string;
};

const BATCH = 8;

export async function processPendingAssets(): Promise<void> {
  const sb = db();

  const { data: candidates } = await sb
    .from('video_assets')
    .select('id, org_id, drive_file_id, drive_md5_checksum, source_id')
    .eq('proxy_status', 'pending')
    .eq('is_deleted_on_drive', false)
    .like('mime_type', 'image/%')
    .limit(BATCH);

  const rows = (candidates ?? []) as AssetRow[];
  if (rows.length === 0) return;

  // Claim — only those still pending after the update are ours.
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

  await dbLog('info', `proxy batch: ${mine.length} asset(s)`);

  const tokenByConn = new Map<string, string>();

  for (const a of mine) {
    try {
      const accessToken = await accessTokenForSource(sb, a.source_id, tokenByConn);
      const bytes = await downloadDriveFile(accessToken, a.drive_file_id);

      const meta = await sharp(bytes).metadata();
      // WebP: ~25-30% smaller than JPEG at equal quality, universally
      // supported. Thumbnails load in a grid so size matters most.
      const thumb = await sharp(bytes)
        .rotate()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      const proxy = await sharp(bytes)
        .rotate()
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const hash = await phash(bytes);

      const base = `${a.org_id}/${a.id}`;
      const thumbPath = await uploadProxy(`${base}/thumb.webp`, thumb, 'image/webp');
      const proxyPath = await uploadProxy(`${base}/proxy.webp`, proxy, 'image/webp');

      const dupOf = await findExactDuplicate(sb, a);

      await sb
        .from('video_assets')
        .update({
          thumb_path: thumbPath,
          proxy_path: proxyPath,
          perceptual_hash: hash,
          width: meta.width ?? null,
          height: meta.height ?? null,
          duplicate_of: dupOf,
          duplicate_status: dupOf ? 'exact' : null,
          proxy_status: 'done',
        })
        .eq('id', a.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ assetId: a.id, err: msg }, 'proxy failed');
      await dbLog('error', 'proxy failed', { assetId: a.id, error: msg });
      await sb
        .from('video_assets')
        .update({ proxy_status: 'error', proxy_error: msg })
        .eq('id', a.id);
    }
  }
}

async function accessTokenForSource(
  sb: ReturnType<typeof db>,
  sourceId: string,
  cache: Map<string, string>,
): Promise<string> {
  const { data: src } = await sb
    .from('video_drive_sources')
    .select('connection_id')
    .eq('id', sourceId)
    .single();
  if (!src) throw new Error('source not found');
  const connId = src.connection_id as string;
  const hit = cache.get(connId);
  if (hit) return hit;

  const { data: conn } = await sb
    .from('google_drive_connections')
    .select('oauth_refresh_enc, status')
    .eq('id', connId)
    .single();
  if (!conn) throw new Error('connection not found');
  if (conn.status !== 'active') throw new Error(`connection ${conn.status}`);
  const token = await refreshAccessToken(decryptToken(conn.oauth_refresh_enc));
  cache.set(connId, token);
  return token;
}

/** Exact dup = same Drive md5 in the same org, processed earlier. */
async function findExactDuplicate(
  sb: ReturnType<typeof db>,
  a: AssetRow,
): Promise<string | null> {
  if (!a.drive_md5_checksum) return null;
  const { data } = await sb
    .from('video_assets')
    .select('id, created_at')
    .eq('org_id', a.org_id)
    .eq('drive_md5_checksum', a.drive_md5_checksum)
    .neq('id', a.id)
    .order('created_at', { ascending: true })
    .limit(1);
  return data && data.length > 0 ? (data[0].id as string) : null;
}
