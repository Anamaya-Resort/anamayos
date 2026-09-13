/**
 * Run the Dropbox inventory here rather than on the worker.
 *
 * The worker has no Dropbox token, and the generated ones expire in
 * about four hours, so for a one-off import it is simpler to crawl
 * from a machine that has the token than to keep feeding short-lived
 * secrets into the deployment.
 */
import 'dotenv/config';
import { db } from '../db.js';
import { inventoryDropboxSource } from '../dropbox/inventory.js';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = class {
    constructor() { throw new Error('realtime unused'); }
  };
}

async function main() {
  const sb = db();
  const { data: sources } = await sb
    .from('video_drive_sources')
    .select('id, org_id, shared_link, label')
    .eq('provider', 'dropbox');

  for (const s of (sources ?? []) as {
    id: string; org_id: string; shared_link: string; label: string;
  }[]) {
    // Claim it so the worker's poller does not crawl the same folder.
    await sb
      .from('video_drive_sources')
      .update({ scan_status: 'scanning', scan_error: null })
      .eq('id', s.id);
    process.stdout.write(`${s.label}... `);
    try {
      const r = await inventoryDropboxSource({
        id: s.id, org_id: s.org_id, shared_link: s.shared_link,
      });
      console.log(`${r.total} media, ${r.skipped} non-media skipped`);
      await sb
        .from('video_drive_sources')
        .update({ scan_status: 'idle', last_scan_at: new Date().toISOString() })
        .eq('id', s.id);
    } catch (e) {
      console.log(`FAILED: ${String(e).slice(0, 140)}`);
      await sb
        .from('video_drive_sources')
        .update({ scan_status: 'error', scan_error: String(e).slice(0, 300) })
        .eq('id', s.id);
    }
  }

  const { data: flagged } = await sb.rpc('flag_duplicate_assets', {
    p_org_id: (sources ?? [])[0]?.org_id,
  });
  const n = Array.isArray(flagged) ? (flagged[0]?.flagged ?? 0) : 0;
  console.log(`\nduplicates flagged and skipped: ${n}`);
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
