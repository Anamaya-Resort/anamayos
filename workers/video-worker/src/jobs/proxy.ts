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
import { downloadDriveFile } from '../google/download.js';
import { uploadProxy } from '../storage.js';
import { dbLog } from '../joblog.js';
import { log } from '../log.js';
import { pool } from '../pool.js';
import { tokenForSource } from '../google/drive-token.js';
import { openImage } from '../image-decode.js';

type AssetRow = {
  id: string;
  org_id: string;
  drive_file_id: string;
  drive_md5_checksum: string | null;
  source_id: string;
  created_at: string;
  proxy_attempts: number;
  mime_type: string;
};

const BATCH = Number(process.env.PROXY_BATCH ?? 24);
/** sharp is CPU-bound, so this wants to track the container's cores. */
const CONCURRENCY = Number(process.env.PROXY_CONCURRENCY ?? 4);
/**
 * A file that has failed this many times is not going to start
 * working on the next redeploy — it's a corrupt file, an unsupported
 * codec, or a permission problem. Retrying it forever burns a Drive
 * download (and, on the analyze side, a paid vision call) after every
 * restart, which is exactly what the old unconditional reclaim did.
 */
export const MAX_ATTEMPTS = 3;

/**
 * Any asset left in 'processing' is orphaned — the worker that
 * claimed it died mid-batch (e.g. a redeploy restart). There's one
 * replica and no in-flight work survives a restart, so reclaim them
 * all. Errored rows are retried too, but only while under the
 * attempt cap. Called once on worker startup.
 */
export async function reclaimOrphanedProxies(): Promise<void> {
  const { data, error } = await db()
    .from('video_assets')
    .update({ proxy_status: 'pending', proxy_error: null })
    .eq('proxy_status', 'processing')
    .select('id');
  if (error) {
    log.error({ err: error.message }, 'reclaim orphaned proxies failed');
    return;
  }
  if (data && data.length > 0) {
    await dbLog('warn', `reclaimed ${data.length} orphaned processing asset(s)`);
  }

  const { data: retried } = await db()
    .from('video_assets')
    .update({ proxy_status: 'pending', proxy_error: null })
    .eq('proxy_status', 'error')
    .lt('proxy_attempts', MAX_ATTEMPTS)
    .select('id');
  if (retried && retried.length > 0) {
    await dbLog('warn', `retrying ${retried.length} errored proxy asset(s)`);
  }
}

/** Tick budget, matching the analyze side. */
const TICK_BUDGET_MS = Number(process.env.PROXY_TICK_MS ?? 4 * 60_000);
let draining = false;

/**
 * Drain until empty or the tick budget expires. Without this the rate
 * is capped at one batch a minute no matter how much is queued, which
 * on a 7,438 image library is hours of deliberate idling.
 */
export async function processPendingAssets(): Promise<void> {
  if (draining) return;
  draining = true;
  const startedAt = Date.now();
  try {
    for (;;) {
      const did = await proxyOneRound();
      if (did === 0) return;
      if (Date.now() - startedAt > TICK_BUDGET_MS) {
        await dbLog('info', 'proxy tick budget reached, yielding');
        return;
      }
    }
  } finally {
    draining = false;
  }
}

async function proxyOneRound(): Promise<number> {
  const sb = db();

  const { data: candidates } = await sb
    .from('video_assets')
    .select(
      'id, org_id, drive_file_id, drive_md5_checksum, source_id, created_at, proxy_attempts, mime_type',
    )
    .eq('proxy_status', 'pending')
    .eq('is_deleted_on_drive', false)
    .like('mime_type', 'image/%')
    .limit(BATCH);

  const rows = (candidates ?? []) as AssetRow[];
  if (rows.length === 0) return 0;

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
  if (mine.length === 0) return 0;

  await dbLog('info', `proxy batch: ${mine.length} asset(s) x${CONCURRENCY}`);

  const tokenByConn = new Map<string, string>();

  await pool(mine, CONCURRENCY, async (a) => {
    try {
      const accessToken = await tokenForSource(a.source_id, tokenByConn);
      const bytes = await downloadDriveFile(accessToken, a.drive_file_id);

      // BMP is decoded first; everything else opens directly.
      const meta = await openImage(bytes, a.mime_type).metadata();
      // WebP: ~25-30% smaller than JPEG at equal quality, universally
      // supported. Thumbnails load in a grid so size matters most.
      const thumb = await openImage(bytes, a.mime_type)
        .rotate()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      const proxy = await openImage(bytes, a.mime_type)
        .rotate()
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      // phash reads the buffer itself, so give it something sharp-safe.
      const hash = await phash(
        await openImage(bytes, a.mime_type).png().toBuffer(),
      );

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
          proxied_at: new Date().toISOString(),
        })
        .eq('id', a.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ assetId: a.id, err: msg }, 'proxy failed');
      await dbLog('error', 'proxy failed', { assetId: a.id, error: msg });
      await sb
        .from('video_assets')
        .update({
          proxy_status: 'error',
          proxy_error: msg,
          proxy_attempts: (a.proxy_attempts ?? 0) + 1,
        })
        .eq('id', a.id);
    }
  });

  return mine.length;
}

/**
 * Exact dup = same Drive md5 in the same org, on a row that entered
 * the library STRICTLY EARLIER and is not itself a duplicate.
 *
 * The earlier-only rule is load-bearing. Without it, two identical
 * files each pointed at the other (inventory inserts both rows before
 * either is processed), so both got flagged 'exact' and neither was
 * the canonical copy — the "possible duplicates" filter then showed
 * every copy of every pair. Anchoring on the oldest non-duplicate row
 * means exactly one canonical asset survives per md5.
 */
async function findExactDuplicate(
  sb: ReturnType<typeof db>,
  a: AssetRow,
): Promise<string | null> {
  if (!a.drive_md5_checksum) return null;
  const { data } = await sb
    .from('video_assets')
    .select('id')
    .eq('org_id', a.org_id)
    .eq('drive_md5_checksum', a.drive_md5_checksum)
    .neq('id', a.id)
    .is('duplicate_of', null)
    .lt('created_at', a.created_at)
    .order('created_at', { ascending: true })
    .limit(1);
  return data && data.length > 0 ? (data[0].id as string) : null;
}
