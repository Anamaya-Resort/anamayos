/**
 * Compare what Drive holds against what we ingested, per source.
 *
 * "It says it scanned but nothing appeared" has two very different
 * causes - a crawl that failed, or a crawl that ran and correctly
 * found nothing new - and the scan status alone cannot tell them
 * apart. This counts both sides.
 */
import 'dotenv/config';
import { db } from '../db.js';
import { getServiceAccountToken } from '../google/service-account.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() { throw new Error('realtime unused'); }
  };
}

const FOLDER = 'application/vnd.google-apps.folder';
const UNDECODABLE = new Set([
  'image/x-canon-cr2', 'image/x-canon-crw', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-panasonic-rw2',
  'image/x-olympus-orf', 'image/x-fuji-raf', 'image/vnd.adobe.photoshop',
]);
const isMedia = (m: string) =>
  !UNDECODABLE.has(m) && /^(image|video|audio)\//.test(m);

async function countTree(token: string, rootId: string): Promise<number> {
  let total = 0;
  const walk = async (id: string, depth: number): Promise<void> => {
    if (depth > 25) return;
    let pageToken: string | undefined;
    do {
      const u = new URL('https://www.googleapis.com/drive/v3/files');
      u.searchParams.set('q', `'${id}' in parents and trashed = false`);
      u.searchParams.set('fields', 'nextPageToken, files(id,mimeType)');
      u.searchParams.set('pageSize', '1000');
      u.searchParams.set('supportsAllDrives', 'true');
      u.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) u.searchParams.set('pageToken', pageToken);
      const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      const j = (await res.json()) as {
        files?: { id: string; mimeType: string }[];
        nextPageToken?: string;
      };
      for (const f of j.files ?? []) {
        if (f.mimeType === FOLDER) await walk(f.id, depth + 1);
        else if (isMedia(f.mimeType)) total++;
      }
      pageToken = j.nextPageToken;
    } while (pageToken);
  };
  await walk(rootId, 0);
  return total;
}

async function main() {
  const sb = db();
  const token = await getServiceAccountToken();

  const { data: sources } = await sb
    .from('video_drive_sources')
    .select('id, label, drive_folder_id, scan_status, last_scan_at')
    .order('label');

  const rows = (sources ?? []) as {
    id: string; label: string; drive_folder_id: string;
    scan_status: string; last_scan_at: string | null;
  }[];

  // Counted per source in the database. Selecting every row and
  // tallying them looks obvious and is wrong: PostgREST caps a
  // response at 1000 rows whatever limit is asked for, which made this
  // script report 1,000 of 6,743 assets and every folder look empty.
  const have = new Map<string, number>();
  await Promise.all(
    rows.map(async (s2) => {
      const { count } = await sb
        .from('video_assets')
        .select('id', { count: 'exact', head: true })
        .eq('source_id', s2.id)
        .eq('is_deleted_on_drive', false);
      have.set(s2.id, count ?? 0);
    }),
  );

  let gaps = 0;
  let driveTotal = 0;
  let haveTotal = 0;
  console.log('folder'.padEnd(44), 'drive'.padStart(6), 'have'.padStart(6), '  status');
  for (const s of rows) {
    let inDrive = -1;
    try {
      inDrive = await countTree(token, s.drive_folder_id);
    } catch (e) {
      console.log(s.label.padEnd(44), 'ERR'.padStart(6), String(have.get(s.id) ?? 0).padStart(6), `  ${String(e)}`);
      continue;
    }
    const mine = have.get(s.id) ?? 0;
    driveTotal += inDrive;
    haveTotal += mine;
    const gap = inDrive - mine;
    if (gap !== 0) {
      gaps++;
      console.log(
        s.label.slice(0, 43).padEnd(44),
        String(inDrive).padStart(6),
        String(mine).padStart(6),
        `  MISSING ${gap}`,
      );
    }
  }
  console.log('');
  console.log(`sources: ${rows.length}   with a gap: ${gaps}`);
  console.log(`drive total: ${driveTotal}   ingested: ${haveTotal}   difference: ${driveTotal - haveTotal}`);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
