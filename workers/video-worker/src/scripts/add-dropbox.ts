/**
 * Register a Dropbox shared folder as a source and queue it.
 *
 *   npx tsx src/scripts/add-dropbox.ts "<shared link>" ["Label"]
 */
import 'dotenv/config';
import { db } from '../db.js';
import { listSharedFolder, hasDropboxToken } from '../dropbox/client.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() { throw new Error('realtime unused'); }
  };
}

async function main() {
  const link = process.argv[2];
  const label = process.argv[3];
  if (!link) throw new Error('usage: add-dropbox.ts "<shared link>" ["Label"]');
  if (!hasDropboxToken()) throw new Error('DROPBOX_ACCESS_TOKEN is not set');

  const sb = db();
  const { data: org } = await sb.from('organizations').select('id').limit(1).single();
  if (!org) throw new Error('no organization');

  // Count first, so the size of the job is known before it starts.
  process.stdout.write('listing the folder... ');
  const files = await listSharedFolder(link);
  console.log(`${files.length} files`);

  const bytes = files.reduce((a, f) => a + f.size, 0);
  console.log(`total ${(bytes / 1024 ** 3).toFixed(2)} GB`);

  const { data, error } = await sb
    .from('video_drive_sources')
    .upsert(
      {
        org_id: org.id,
        provider: 'dropbox',
        connection_id: null,
        shared_link: link,
        label: label ?? 'Dropbox folder',
        drive_kind: 'shared_link',
        // The link is the folder identity for a Dropbox source.
        drive_folder_id: link.split('?')[0],
        drive_id: null,
        watch_mode: 'on_demand',
        is_active: true,
        scan_status: 'pending',
        scan_error: null,
      },
      { onConflict: 'org_id,drive_folder_id' },
    )
    .select('id, label')
    .single();
  if (error) throw new Error(error.message);

  console.log(`queued "${data.label}" (${data.id})`);
  console.log('The worker will crawl it within a minute, flag duplicates, then process what is new.');
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
