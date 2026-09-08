/**
 * Register each top-level folder of a Drive tree as its own source.
 *
 * One source per folder rather than one for the whole tree, because
 * the sources panel then shows real per-folder progress and a folder
 * can be rescanned or removed on its own. The crawler still recurses,
 * so nested folders come along with their parent.
 *
 *   npx tsx src/scripts/add-sources.ts <folder-url-or-id> [--dry]
 */
import 'dotenv/config';
import { db } from '../db.js';
import { getServiceAccountToken, hasServiceAccount } from '../google/service-account.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() { throw new Error('realtime unused'); }
  };
}

const FOLDER = 'application/vnd.google-apps.folder';

/**
 * Folders holding the same photographs at another resolution. Tagging
 * these would pay for the same picture several times over and fill the
 * library with one image at six sizes. The originals live in the
 * themed folders.
 */
const SKIP = /(\d+\s*(px|pixels))|high res|^re-optimized/i;

function parseFolderId(s: string): string {
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(s.trim())) return s.trim();
  throw new Error(`no folder id in: ${s}`);
}

async function main() {
  const input = process.argv[2];
  const dry = process.argv.includes('--dry');
  if (!input) throw new Error('usage: add-sources.ts <folder-url-or-id> [--dry]');
  if (!hasServiceAccount()) throw new Error('GOOGLE_SA_KEY_FILE / _JSON not set');

  const rootId = parseFolderId(input);
  const token = await getServiceAccountToken();
  const sb = db();

  const { data: conn } = await sb
    .from('google_drive_connections')
    .select('id, org_id, google_account_email')
    .eq('auth_mode', 'service_account')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!conn) throw new Error('no active service_account connection row');
  console.log(`connection: ${conn.google_account_email}\n`);

  const folders: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${rootId}' in parents and mimeType = '${FOLDER}' and trashed = false`);
    u.searchParams.set('fields', 'nextPageToken, files(id,name)');
    u.searchParams.set('pageSize', '500');
    u.searchParams.set('orderBy', 'name');
    u.searchParams.set('supportsAllDrives', 'true');
    u.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`list failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { files?: { id: string; name: string }[]; nextPageToken?: string };
    folders.push(...(j.files ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken);

  const keep = folders.filter((f) => !SKIP.test(f.name));
  const skipped = folders.filter((f) => SKIP.test(f.name));

  console.log(`SKIPPING ${skipped.length} resolution-duplicate folders:`);
  for (const f of skipped) console.log(`  - ${f.name}`);
  console.log(`\nADDING ${keep.length} folders as sources`);

  if (dry) { console.log('\n(dry run, nothing written)'); return; }

  let added = 0;
  for (const f of keep) {
    const { error } = await sb.from('video_drive_sources').upsert(
      {
        org_id: conn.org_id,
        connection_id: conn.id,
        label: f.name,
        drive_kind: 'my_drive_folder',
        drive_folder_id: f.id,
        drive_id: null,
        watch_mode: 'on_demand',
        is_active: true,
        scan_status: 'pending',
        scan_error: null,
      },
      { onConflict: 'org_id,drive_folder_id' },
    );
    if (error) console.error(`  ! ${f.name}: ${error.message}`);
    else added++;
  }
  console.log(`\nqueued ${added} folders for scanning`);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
