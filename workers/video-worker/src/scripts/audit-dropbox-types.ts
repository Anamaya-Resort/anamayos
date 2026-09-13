/**
 * Read-only: every file extension in the Dropbox shares, and whether
 * the crawler recognises it.
 *
 * Dropbox does not report a mime type, so the crawler infers one from
 * the file extension against a fixed table. Anything not in that
 * table is dropped silently - which is exactly how a whole category
 * of video could go missing without ever showing up as an error.
 */
import 'dotenv/config';
import { db } from '../db.js';
import { listSharedFolder } from '../dropbox/client.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() { throw new Error('realtime unused'); }
  };
}

// Copied from dropbox/inventory.ts - the table under test.
const KNOWN = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'heif',
  'mp4', 'mov', 'm4v', 'avi', 'webm',
  'cr2', 'nef', 'arw', 'dng', 'psd',
]);
// Extensions that are video but are NOT in the table above.
const VIDEO_EXT = new Set([
  'mkv', 'mpg', 'mpeg', 'm2v', 'wmv', 'flv', 'f4v', '3gp', '3g2', 'mts',
  'm2ts', 'ts', 'vob', 'ogv', 'ogg', 'mxf', 'asf', 'divx', 'rm', 'rmvb',
  'qt', 'mp4v', 'mpe', 'dv', 'amv', 'm4p',
]);

async function main() {
  const { data: rows } = await db()
    .from('video_drive_sources')
    .select('id, label, shared_link')
    .eq('drive_kind', 'shared_link');

  const counts = new Map<string, number>();
  const missedVideos: string[] = [];

  for (const s of (rows ?? []) as {
    id: string; label: string; shared_link: string;
  }[]) {
    if (!s.shared_link) continue;
    console.log(`walking ${s.label} ...`);
    const files = await listSharedFolder(s.shared_link);
    for (const f of files) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '(none)';
      counts.set(ext, (counts.get(ext) ?? 0) + 1);
      if (!KNOWN.has(ext) && VIDEO_EXT.has(ext)) {
        missedVideos.push(`${s.label}  ${f.path}`);
      }
    }
  }

  console.log('\n=== every extension in the Dropbox shares ===');
  for (const [e, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    const known = KNOWN.has(e);
    const isVid = VIDEO_EXT.has(e);
    const mark = known ? 'ingested' : isVid ? '** VIDEO, SKIPPED **' : 'skipped';
    console.log(`  .${e.padEnd(10)}${String(n).padStart(6)}   ${mark}`);
  }

  console.log(`\nvideo files skipped because the extension is unknown: ${missedVideos.length}`);
  for (const m of missedVideos.slice(0, 40)) console.log('  ' + m);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
