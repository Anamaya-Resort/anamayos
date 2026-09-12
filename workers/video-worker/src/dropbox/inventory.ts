/**
 * Inventory a Dropbox shared folder into video_assets.
 *
 * Deliberately the same shape as the Drive crawl: walk, upsert in
 * batches, let the existing proxy and tagging jobs take it from
 * there. Everything after inventory is provider-agnostic already.
 *
 * The duplicate question is the interesting part. Dropbox hashes
 * content its own way (block-based SHA-256), so its hash cannot be
 * compared with the MD5 Drive gives us. Within Dropbox the hash is
 * exact and free; across providers, flag_duplicate_assets falls back
 * to filename plus exact byte size, which is reliable for photographs
 * and - crucially - happens before anything is downloaded or tagged.
 */
import { db } from '../db.js';
import { listSharedFolder, type DropboxFile } from './client.js';
import { dbLog } from '../joblog.js';
import { log } from '../log.js';

const UNDECODABLE = new Set([
  'image/x-canon-cr2', 'image/x-canon-crw', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-panasonic-rw2',
  'image/x-olympus-orf', 'image/x-fuji-raf', 'image/vnd.adobe.photoshop',
]);

/** Dropbox does not report a MIME type, so infer it from the name. */
const BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
  avi: 'video/x-msvideo', webm: 'video/webm',
  cr2: 'image/x-canon-cr2', nef: 'image/x-nikon-nef', arw: 'image/x-sony-arw',
  dng: 'image/x-adobe-dng', psd: 'image/vnd.adobe.photoshop',
};

function mimeFor(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? (BY_EXT[ext] ?? null) : null;
}

function isWanted(mime: string | null): boolean {
  if (!mime) return false;
  if (UNDECODABLE.has(mime)) return false;
  return /^(image|video|audio)\//.test(mime);
}

export async function inventoryDropboxSource(src: {
  id: string;
  org_id: string;
  shared_link: string;
}): Promise<{ total: number; skipped: number }> {
  const sb = db();
  let total = 0;
  let skipped = 0;

  const upsert = async (files: DropboxFile[]) => {
    const rows = files
      .map((f) => {
        const mime = mimeFor(f.name);
        if (!isWanted(mime)) {
          skipped++;
          return null;
        }
        total++;
        return {
          org_id: src.org_id,
          source_id: src.id,
          provider: 'dropbox',
          // The path is the stable identity inside a shared folder;
          // Dropbox ids are not stable across shares.
          drive_file_id: f.path,
          drive_path: f.path,
          content_hash: f.contentHash,
          mime_type: mime as string,
          file_name: f.name,
          size_bytes: f.size,
          captured_at: f.clientModified,
          // analysis_status is left to its default so a rescan never
          // resets work already done, same rule as the Drive crawl.
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) return;
    const { error } = await sb
      .from('video_assets')
      .upsert(rows, { onConflict: 'source_id,drive_file_id' });
    if (error) throw new Error(`dropbox asset upsert failed: ${error.message}`);
  };

  await listSharedFolder(src.shared_link, upsert);
  log.info({ sourceId: src.id, total, skipped }, 'dropbox inventory complete');
  await dbLog('info', 'dropbox inventory complete', {
    sourceId: src.id,
    files: total,
    skippedNonMedia: skipped,
  });
  return { total, skipped };
}
