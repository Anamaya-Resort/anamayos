/**
 * Read-only: what video files does Drive actually hold, and how many
 * of them did we ingest?
 *
 * "60 videos out of 60-odd folders" is a suspiciously round-sounding
 * number, and the two providers filter differently - Drive trusts the
 * mime type it reports, Dropbox guesses from the file extension - so
 * a gap would land in only one of them. This counts the Drive side
 * against the database, by type.
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

type F = { id: string; name: string; mimeType: string; size?: string };

async function walk(token: string, rootId: string): Promise<F[]> {
  const out: F[] = [];
  const seen = new Set<string>();
  const rec = async (id: string, depth: number): Promise<void> => {
    if (depth > 25 || seen.has(id)) return;
    seen.add(id);
    let page: string | undefined;
    do {
      const u = new URL('https://www.googleapis.com/drive/v3/files');
      u.searchParams.set('q', `'${id}' in parents and trashed = false`);
      u.searchParams.set('fields', 'nextPageToken, files(id,name,mimeType,size)');
      u.searchParams.set('pageSize', '1000');
      u.searchParams.set('supportsAllDrives', 'true');
      u.searchParams.set('includeItemsFromAllDrives', 'true');
      if (page) u.searchParams.set('pageToken', page);
      const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const j = (await res.json()) as { files?: F[]; nextPageToken?: string };
      for (const f of j.files ?? []) {
        if (f.mimeType === FOLDER) await rec(f.id, depth + 1);
        else out.push(f);
      }
      page = j.nextPageToken;
    } while (page);
  };
  await rec(rootId, 0);
  return out;
}

async function main() {
  const token = await getServiceAccountToken();
  const { data: rows } = await db()
    .from('video_drive_sources')
    .select('id, label, drive_folder_id, drive_kind')
    .neq('drive_kind', 'shared_link');

  const byMime = new Map<string, number>();
  const driveVideos: { source: string; name: string; mb: number }[] = [];
  const unclassified: string[] = [];

  for (const s of (rows ?? []) as {
    id: string; label: string; drive_folder_id: string;
  }[]) {
    try {
      for (const f of await walk(token, s.drive_folder_id)) {
        byMime.set(f.mimeType, (byMime.get(f.mimeType) ?? 0) + 1);
        if (f.mimeType === 'application/octet-stream' || f.mimeType === 'application/pdf') {
          unclassified.push(`${f.mimeType.split('/')[1]}  ${f.name}`);
        }
        if (f.mimeType.startsWith('video/')) {
          driveVideos.push({
            source: s.label,
            name: f.name,
            mb: Math.round(Number(f.size ?? 0) / 1e6),
          });
        }
      }
    } catch (e) {
      console.log(`  !! ${s.label}: ${String(e).slice(0, 120)}`);
    }
  }

  console.log('\n=== files Drive could not classify (would be skipped) ===');
  for (const u of unclassified.slice(0, 45)) console.log('  ' + u);

  console.log('\n=== every file type in Drive ===');
  for (const [m, n] of [...byMime].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`  ${m.padEnd(46)}${String(n).padStart(6)}`);
  }
  const total = [...byMime.values()].reduce((a, b) => a + b, 0);
  const vidCount = [...byMime].filter(([m]) => m.startsWith('video/'))
    .reduce((a, [, n]) => a + n, 0);
  console.log(`\nfiles in Drive: ${total}`);
  console.log(`videos in Drive: ${vidCount}`);

  const { data: have } = await db()
    .from('video_assets')
    .select('file_name')
    .like('mime_type', 'video/%');
  const haveNames = new Set(
    ((have ?? []) as { file_name: string }[]).map((r) => r.file_name),
  );
  console.log(`videos in database: ${haveNames.size}`);

  const missing = driveVideos.filter((v) => !haveNames.has(v.name));
  console.log(`\nvideos in Drive but NOT ingested: ${missing.length}`);
  for (const m of missing.slice(0, 40)) {
    console.log(`  ${m.source.slice(0, 34).padEnd(36)} ${m.name.slice(0, 46).padEnd(48)} ${m.mb}MB`);
  }
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
