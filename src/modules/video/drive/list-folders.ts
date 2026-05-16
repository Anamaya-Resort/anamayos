/**
 * List immediate subfolders of a Drive folder via the Drive REST API.
 * Powers our own folder browser — no Google Picker iframe.
 */
import { getAccessTokenForConnection } from './token-refresh';

export type DriveFolder = { id: string; name: string };

export async function listDriveFolders(opts: {
  orgId: string;
  connectionId: string;
  parentId: string; // 'root' for My Drive top level
}): Promise<DriveFolder[]> {
  const accessToken = await getAccessTokenForConnection(
    opts.orgId,
    opts.connectionId,
  );

  const q = [
    `'${opts.parentId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id,name),nextPageToken');
  url.searchParams.set('pageSize', '200');
  url.searchParams.set('orderBy', 'name');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const folders: DriveFolder[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      files?: DriveFolder[];
      nextPageToken?: string;
    };
    for (const f of json.files ?? []) folders.push({ id: f.id, name: f.name });
    pageToken = json.nextPageToken;
  } while (pageToken);

  return folders;
}
