/**
 * Count what is in a Drive folder before ingesting it.
 *
 * Read-only. Walks the tree with the org's existing connection and
 * reports file counts, bytes and a per-subfolder breakdown, plus what
 * tagging it would cost at each candidate model's measured rate. The
 * point is to know the size of a job before paying for it, rather
 * than extrapolating from MAX_FILES like the plan documents did.
 *
 *   npx tsx src/scripts/count-drive.ts <folder-url-or-id>
 */
import 'dotenv/config';
import { db } from '../db.js';
import { decryptToken } from '../crypto.js';
import { refreshAccessToken } from '../google/refresh.js';
import {
  hasServiceAccount,
  getServiceAccountToken,
  serviceAccountEmail,
} from '../google/service-account.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() { throw new Error('realtime unused'); }
  };
}

const FOLDER = 'application/vnd.google-apps.folder';
// Measured per-image cost, from the 12-photo bakeoff at 768px.
const RATES: [string, number][] = [
  ['gemini-3.1-flash-lite', 0.00145],
  ['claude-haiku-4-5', 0.00435],
  ['claude-sonnet-5', 0.01025],
];

function parseFolderId(s: string): string {
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(s.trim())) return s.trim();
  throw new Error(`could not find a folder id in: ${s}`);
}

type Bucket = { images: number; videos: number; other: number; bytes: number };
const blank = (): Bucket => ({ images: 0, videos: 0, other: 0, bytes: 0 });

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('usage: count-drive.ts <folder-url-or-id>');
  const rootId = parseFolderId(input);

  // Prefer the service account when one is configured: it does not
  // expire, unlike the stored OAuth refresh tokens.
  let token: string;
  if (hasServiceAccount()) {
    const who = await serviceAccountEmail();
    console.log(`using service account ${who}\n`);
    token = await getServiceAccountToken();
  } else {
    const { data: conn } = await db()
      .from('google_drive_connections')
      .select('google_account_email, oauth_refresh_enc, status')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!conn) throw new Error('no active Google connection and no service account key');
    console.log(`using OAuth connection ${conn.google_account_email}\n`);
    token = await refreshAccessToken(decryptToken(conn.oauth_refresh_enc));
  }

  const metaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${rootId}`);
  metaUrl.searchParams.set('fields', 'id,name,mimeType,owners(emailAddress)');
  metaUrl.searchParams.set('supportsAllDrives', 'true');
  const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!metaRes.ok) {
    console.error(`CANNOT SEE IT: ${metaRes.status}`);
    console.error((await metaRes.text()).slice(0, 400));
    if (hasServiceAccount()) {
      console.error(`\nShare the folder with ${await serviceAccountEmail()} (Viewer).`);
    } else {
      console.error('\nShare the folder with the connected account, or connect the owner.');
    }
    process.exit(2);
  }
  const meta = (await metaRes.json()) as { name?: string; mimeType?: string; owners?: { emailAddress: string }[] };
  if (meta.mimeType !== FOLDER) throw new Error('that link is a file, not a folder');
  console.log(`FOLDER: ${meta.name}`);
  console.log(`owner:  ${meta.owners?.[0]?.emailAddress ?? 'unknown'}\n`);

  const total = blank();
  const perTop = new Map<string, Bucket>();
  let folders = 0;
  let deepest = 0;

  async function walk(id: string, top: string, depth: number) {
    deepest = Math.max(deepest, depth);
    let pageToken: string | undefined;
    do {
      const u = new URL('https://www.googleapis.com/drive/v3/files');
      u.searchParams.set('q', `'${id}' in parents and trashed = false`);
      u.searchParams.set('fields', 'nextPageToken, files(id,name,mimeType,size)');
      u.searchParams.set('pageSize', '1000');
      u.searchParams.set('supportsAllDrives', 'true');
      u.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) u.searchParams.set('pageToken', pageToken);
      const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`list failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = (await res.json()) as { files?: { id: string; name: string; mimeType: string; size?: string }[]; nextPageToken?: string };

      for (const f of j.files ?? []) {
        if (f.mimeType === FOLDER) {
          folders++;
          await walk(f.id, depth === 0 ? f.name : top, depth + 1);
          continue;
        }
        const b = perTop.get(top) ?? blank();
        const bytes = f.size ? Number(f.size) : 0;
        if (f.mimeType.startsWith('image/')) { b.images++; total.images++; }
        else if (f.mimeType.startsWith('video/')) { b.videos++; total.videos++; }
        else { b.other++; total.other++; }
        b.bytes += bytes; total.bytes += bytes;
        perTop.set(top, b);
        if ((total.images + total.videos + total.other) % 500 === 0) {
          process.stdout.write(`  ...${total.images + total.videos + total.other} files\r`);
        }
      }
      pageToken = j.nextPageToken;
    } while (pageToken);
  }

  await walk(rootId, '(root)', 0);

  const gb = (n: number) => (n / 1024 ** 3).toFixed(2);
  console.log(`\nsubfolders: ${folders}   max depth: ${deepest}\n`);
  console.log('BY TOP-LEVEL FOLDER');
  const sorted = [...perTop.entries()].sort((a, b) => (b[1].images + b[1].videos) - (a[1].images + a[1].videos));
  for (const [name, b] of sorted) {
    console.log(`  ${name.slice(0, 44).padEnd(46)} ${String(b.images).padStart(6)} img ${String(b.videos).padStart(5)} vid ${gb(b.bytes).padStart(8)} GB`);
  }
  console.log(`\nTOTAL  ${total.images} images, ${total.videos} videos, ${total.other} other, ${gb(total.bytes)} GB`);

  console.log('\nTAGGING COST FOR THE IMAGES (measured rates, 768px):');
  for (const [m, rate] of RATES) {
    console.log(`  ${m.padEnd(24)} $${(total.images * rate).toFixed(2)}`);
  }
  console.log('\n(Batch API would roughly halve each of these.)');
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
