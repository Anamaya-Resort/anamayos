/**
 * Recursive Drive folder walk. Inventory only — metadata, no downloads.
 * Handles My Drive folders and Shared Drives. Yields media files
 * (image/*, video/*, audio/*); recurses into subfolders; tracks the
 * folder path string for each file.
 */
import { google, drive_v3 } from 'googleapis';

export type DriveFile = {
  driveFileId: string;
  name: string;
  mimeType: string;
  path: string;
  sizeBytes: number | null;
  md5: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  capturedAt: string | null;
};

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MEDIA_PREFIXES = ['image/', 'video/', 'audio/'];
const MAX_FILES = 50000; // safety cap for a single crawl
const FIELDS =
  'nextPageToken, files(id,name,mimeType,size,md5Checksum,createdTime,videoMediaMetadata,imageMediaMetadata)';

function driveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

function isMedia(mime: string): boolean {
  return MEDIA_PREFIXES.some((p) => mime.startsWith(p));
}

// Drive returns EXIF times as `YYYY:MM:DD HH:MM:SS` (invalid for
// Postgres). Normalize to ISO or null. Same fix as the app crawl.
function toIsoOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const exif = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](.+)$/);
  const candidate = exif ? `${exif[1]}-${exif[2]}-${exif[3]}T${exif[4]}` : s;
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function crawlFolder(opts: {
  accessToken: string;
  rootFolderId: string;
  driveId?: string | null;
  onBatch: (files: DriveFile[]) => Promise<void>;
}): Promise<{ total: number }> {
  const drive = driveClient(opts.accessToken);
  let total = 0;
  const batch: DriveFile[] = [];

  async function flush() {
    if (batch.length === 0) return;
    await opts.onBatch(batch.splice(0, batch.length));
  }

  async function walk(folderId: string, pathPrefix: string, depth: number) {
    if (total >= MAX_FILES || depth > 25) return;
    let pageToken: string | undefined;
    do {
      const params: drive_v3.Params$Resource$Files$List = {
        q: `'${folderId}' in parents and trashed = false`,
        fields: FIELDS,
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      };
      if (opts.driveId) {
        params.corpora = 'drive';
        params.driveId = opts.driveId;
      }
      const res = await drive.files.list(params);
      const files = res.data.files ?? [];
      for (const f of files) {
        if (!f.id || !f.name || !f.mimeType) continue;
        if (f.mimeType === FOLDER_MIME) {
          await walk(f.id, `${pathPrefix}/${f.name}`, depth + 1);
          continue;
        }
        if (!isMedia(f.mimeType)) continue;
        if (total >= MAX_FILES) break;
        const vm = f.videoMediaMetadata;
        const im = f.imageMediaMetadata;
        batch.push({
          driveFileId: f.id,
          name: f.name,
          mimeType: f.mimeType,
          path: `${pathPrefix}/${f.name}`,
          sizeBytes: f.size ? Number(f.size) : null,
          md5: f.md5Checksum ?? null,
          durationMs: vm?.durationMillis ? Number(vm.durationMillis) : null,
          width: vm?.width ?? im?.width ?? null,
          height: vm?.height ?? im?.height ?? null,
          capturedAt: toIsoOrNull(im?.time) ?? toIsoOrNull(f.createdTime),
        });
        total++;
        if (batch.length >= 500) await flush();
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && total < MAX_FILES);
  }

  await walk(opts.rootFolderId, '', 0);
  await flush();
  return { total };
}
