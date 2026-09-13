/**
 * Report what a Dropbox shared folder would add, before it adds it.
 *
 *   npx tsx src/scripts/dropbox-preview.ts "<link>" ["<link2>"]
 *
 * Downloading 10 GB to discover most of it is already held would be a
 * poor way to find that out, so this compares first. Dropbox hashes
 * differently from Drive, so the cross-provider test is filename plus
 * exact byte size - reliable for photographs, and free.
 */
import 'dotenv/config';
import { db } from '../db.js';
import { listSharedFolder } from '../dropbox/client.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() { throw new Error('realtime unused'); }
  };
}

const BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4',
  mov: 'video/quicktime', m4v: 'video/x-m4v', avi: 'video/x-msvideo',
  webm: 'video/webm',
};
const isMedia = (n: string) => !!BY_EXT[n.split('.').pop()?.toLowerCase() ?? ''];

const gb = (n: number) => (n / 1024 ** 3).toFixed(2);

async function main() {
  const links = process.argv.slice(2).filter((a) => a.startsWith('http'));
  if (links.length === 0) throw new Error('give one or more shared links');

  const sb = db();

  // Everything we already hold, keyed by name + exact size. Paged,
  // because PostgREST caps a response at 1000 rows however large the
  // limit asked for.
  const held = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from('video_assets')
      .select('file_name, size_bytes')
      .eq('is_deleted_on_drive', false)
      .range(from, from + 999);
    const rows = (data ?? []) as { file_name: string; size_bytes: number | null }[];
    for (const r of rows) held.add(`${r.file_name}::${r.size_bytes ?? 0}`);
    if (rows.length < 1000) break;
  }
  console.log(`already in the collection: ${held.size} files\n`);

  const seen = new Set<string>();
  let grandNew = 0;
  let grandNewBytes = 0;

  for (const link of links) {
    process.stdout.write(`listing ${link.slice(0, 52)}... `);
    const files = await listSharedFolder(link);
    const media = files.filter((f) => isMedia(f.name));
    console.log(`${files.length} files, ${media.length} media`);

    let dupHere = 0, dupOther = 0, fresh = 0, freshBytes = 0;
    for (const f of media) {
      const key = `${f.name}::${f.size}`;
      if (f.contentHash && seen.has(f.contentHash)) { dupOther++; continue; }
      if (f.contentHash) seen.add(f.contentHash);
      if (held.has(key)) { dupHere++; continue; }
      fresh++; freshBytes += f.size;
      held.add(key);
    }
    console.log(`   already held (name+size): ${dupHere}`);
    console.log(`   duplicate of the other link: ${dupOther}`);
    console.log(`   NEW: ${fresh}  (${gb(freshBytes)} GB)\n`);
    grandNew += fresh; grandNewBytes += freshBytes;
  }

  console.log(`TOTAL NEW: ${grandNew} files, ${gb(grandNewBytes)} GB`);
  console.log(`Tagging those at ~$0.011 each: about $${(grandNew * 0.011).toFixed(2)}`);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
