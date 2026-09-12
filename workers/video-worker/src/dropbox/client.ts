/**
 * Dropbox, reached through a shared folder link.
 *
 * A shared link needs no per-user connection: one app token plus the
 * link is enough to walk the folder and pull files out of it. That is
 * a better fit than OAuth for "here are some folders, take the
 * photos", and it means a Dropbox source has no connection row.
 *
 * The token is short-lived by default (about four hours), which suits
 * a one-off import. Keeping folders in sync would need a refresh
 * token, and that is a different setup.
 */
const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

export type DropboxFile = {
  /** Path inside the shared folder, e.g. /Drone/sunset.jpg */
  path: string;
  name: string;
  id: string;
  size: number;
  /** Dropbox's own block hash. NOT an MD5 and not comparable to one. */
  contentHash: string | null;
  clientModified: string | null;
};

function token(): string {
  const t = process.env.DROPBOX_ACCESS_TOKEN;
  if (!t) throw new Error('DROPBOX_ACCESS_TOKEN is not set');
  return t;
}

function retryable(status: number, err: Error): Error {
  if (status === 429 || status >= 500) {
    (err as Error & { retryable?: boolean }).retryable = true;
  }
  return err;
}

async function rpc<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw retryable(res.status, new Error(`dropbox ${res.status}: ${text}`));
  }
  return (await res.json()) as T;
}

type Entry = {
  '.tag': 'file' | 'folder' | 'deleted';
  name: string;
  id?: string;
  path_display?: string;
  path_lower?: string;
  size?: number;
  content_hash?: string;
  client_modified?: string;
};

/**
 * Every file under a shared folder link, recursively.
 *
 * Dropbox recurses server-side, which is one request per 2,000
 * entries rather than one per folder.
 */
export async function listSharedFolder(
  sharedLink: string,
  onBatch?: (files: DropboxFile[]) => Promise<void>,
): Promise<DropboxFile[]> {
  const all: DropboxFile[] = [];

  const take = async (entries: Entry[]) => {
    const batch: DropboxFile[] = [];
    for (const e of entries) {
      if (e['.tag'] !== 'file') continue;
      batch.push({
        path: e.path_display ?? `/${e.name}`,
        name: e.name,
        id: e.id ?? e.path_lower ?? e.name,
        size: e.size ?? 0,
        contentHash: e.content_hash ?? null,
        clientModified: e.client_modified ?? null,
      });
    }
    all.push(...batch);
    if (onBatch && batch.length > 0) await onBatch(batch);
  };

  type Page = { entries: Entry[]; cursor: string; has_more: boolean };
  let page = await rpc<Page>('/files/list_folder', {
    path: '',
    shared_link: { url: sharedLink },
    recursive: true,
    limit: 2000,
    include_non_downloadable_files: false,
  });
  await take(page.entries);

  while (page.has_more) {
    page = await rpc<Page>('/files/list_folder/continue', { cursor: page.cursor });
    await take(page.entries);
  }

  return all;
}

/** Download one file from inside a shared folder. */
export async function downloadSharedFile(
  sharedLink: string,
  pathInFolder: string,
): Promise<Buffer> {
  const res = await fetch(`${CONTENT}/sharing/get_shared_link_file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      // Content endpoints take their arguments as a header, and that
      // header must be ASCII - hence the escaping below.
      'Dropbox-API-Arg': asciiJson({ url: sharedLink, path: pathInFolder }),
    },
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw retryable(res.status, new Error(`dropbox download ${res.status}: ${text}`));
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Dropbox-API-Arg must be ASCII, so anything above 0x7F is sent as a
 * \uXXXX escape. Filenames here include accents and emoji.
 */
function asciiJson(v: unknown): string {
  return JSON.stringify(v).replace(/[\u007f-\uffff]/g, (c) =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

export function hasDropboxToken(): boolean {
  return !!process.env.DROPBOX_ACCESS_TOKEN;
}
