/**
 * App-side recursive Drive inventory crawl. Metadata only — no
 * downloads, no FFmpeg — so it's light enough to run in a Next.js
 * route. The Railway worker is reserved for Slice 2+ heavy work
 * (proxies, thumbnails, AI). Mirrors the worker's crawl logic but
 * uses fetch + the cached access token (no googleapis SDK).
 */
import { createServiceClient } from '@/lib/supabase/server';
import { getAccessTokenForConnection } from './token-refresh';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MEDIA_PREFIXES = ['image/', 'video/', 'audio/'];
const MAX_FILES = 20000;
const FIELDS =
  'nextPageToken, files(id,name,mimeType,size,md5Checksum,createdTime,videoMediaMetadata,imageMediaMetadata)';

type DriveApiFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  createdTime?: string;
  videoMediaMetadata?: { durationMillis?: string; width?: number; height?: number };
  imageMediaMetadata?: { width?: number; height?: number; time?: string };
};

function isMedia(mime: string): boolean {
  return MEDIA_PREFIXES.some((p) => mime.startsWith(p));
}

export async function crawlSource(opts: {
  orgId: string;
  sourceId: string;
  connectionId: string;
  rootFolderId: string;
}): Promise<{ total: number }> {
  const supabase = createServiceClient();
  const accessToken = await getAccessTokenForConnection(
    opts.orgId,
    opts.connectionId,
  );

  let total = 0;
  let batch: Record<string, unknown>[] = [];

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from('video_assets')
      .upsert(batch, { onConflict: 'source_id,drive_file_id' });
    if (error) throw new Error(`asset upsert failed: ${error.message}`);
    batch = [];
  }

  async function walk(folderId: string, pathPrefix: string, depth: number) {
    if (total >= MAX_FILES || depth > 25) return;
    let pageToken: string | undefined;
    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
      url.searchParams.set('fields', FIELDS);
      url.searchParams.set('pageSize', '1000');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as {
        files?: DriveApiFile[];
        nextPageToken?: string;
      };

      for (const f of json.files ?? []) {
        if (!f.id || !f.name || !f.mimeType) continue;
        if (f.mimeType === FOLDER_MIME) {
          await walk(f.id, `${pathPrefix}/${f.name}`, depth + 1);
          continue;
        }
        if (!isMedia(f.mimeType) || total >= MAX_FILES) continue;
        const vm = f.videoMediaMetadata;
        const im = f.imageMediaMetadata;
        batch.push({
          org_id: opts.orgId,
          source_id: opts.sourceId,
          drive_file_id: f.id,
          drive_path: `${pathPrefix}/${f.name}`,
          drive_md5_checksum: f.md5Checksum ?? null,
          mime_type: f.mimeType,
          file_name: f.name,
          size_bytes: f.size ? Number(f.size) : null,
          duration_ms: vm?.durationMillis ? Number(vm.durationMillis) : null,
          width: vm?.width ?? im?.width ?? null,
          height: vm?.height ?? im?.height ?? null,
          captured_at: im?.time ?? f.createdTime ?? null,
          analysis_status: 'pending',
        });
        total++;
        if (batch.length >= 500) await flush();
      }
      pageToken = json.nextPageToken;
    } while (pageToken && total < MAX_FILES);
  }

  await walk(opts.rootFolderId, '', 0);
  await flush();
  return { total };
}
