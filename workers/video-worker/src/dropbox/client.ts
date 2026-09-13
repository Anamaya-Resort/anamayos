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
import { accessTokenFromRefresh, hasRefreshToken } from './oauth.js';

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

/**
 * Prefer the refresh token: it does not expire, so a long import
 * cannot outlive its own credential. A pasted DROPBOX_ACCESS_TOKEN
 * still works for a quick one-off.
 */
async function token(): Promise<string> {
  if (hasRefreshToken()) return accessTokenFromRefresh();
  const t = process.env.DROPBOX_ACCESS_TOKEN;
  if (!t) {
    throw new Error(
      'No Dropbox credential: set DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY, or DROPBOX_ACCESS_TOKEN',
    );
  }
  return t;
}

function retryable(status: number, err: Error): Error {
  if (status === 429 || status >= 500) {
    (err as Error & { retryable?: boolean }).retryable = true;
  }
  return err;
}

/**
 * A folder walk makes hundreds of calls, so a single dropped socket
 * should not lose the whole crawl. Retries the transport failure and
 * the statuses worth waiting on; a real error still surfaces at once.
 */
async function rpc<T>(path: string, body: unknown, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // "fetch failed" - a dropped connection, not an API refusal.
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return rpc<T>(path, body, attempt + 1);
    }
    throw err;
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      return rpc<T>(path, body, attempt + 1);
    }
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
 * Every file under a shared folder link.
 *
 * Walked one folder at a time on purpose: Dropbox refuses
 * `recursive: true` on a shared link ("Recursive list folder is not
 * supported for shared link"), so the recursion has to happen here.
 * Paths are relative to the shared root, which is also how the
 * download endpoint addresses a file.
 */
export async function listSharedFolder(
  sharedLink: string,
  onBatch?: (files: DropboxFile[]) => Promise<void>,
  onProgress?: (seen: number, folder: string) => void,
): Promise<DropboxFile[]> {
  const all: DropboxFile[] = [];
  type Page = { entries: Entry[]; cursor: string; has_more: boolean };

  const walk = async (path: string, depth: number): Promise<void> => {
    if (depth > 25) return;
    const subfolders: string[] = [];

    const take = async (entries: Entry[]) => {
      const batch: DropboxFile[] = [];
      for (const e of entries) {
        if (e['.tag'] === 'folder') {
          subfolders.push(`${path}/${e.name}`);
          continue;
        }
        if (e['.tag'] !== 'file') continue;
        batch.push({
          path: `${path}/${e.name}`,
          name: e.name,
          id: e.id ?? `${path}/${e.name}`,
          size: e.size ?? 0,
          contentHash: e.content_hash ?? null,
          clientModified: e.client_modified ?? null,
        });
      }
      all.push(...batch);
      if (onBatch && batch.length > 0) await onBatch(batch);
      onProgress?.(all.length, path || '/');
    };

    let page = await rpc<Page>('/files/list_folder', {
      path,
      shared_link: { url: sharedLink },
      limit: 2000,
      include_non_downloadable_files: false,
    });
    await take(page.entries);
    while (page.has_more) {
      page = await rpc<Page>('/files/list_folder/continue', { cursor: page.cursor });
      await take(page.entries);
    }

    for (const sub of subfolders) await walk(sub, depth + 1);
  };

  await walk('', 0);
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
      Authorization: `Bearer ${await token()}`,
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

/**
 * Stream a shared file straight to disk. Videos are far too large to
 * sit in a Buffer, and ffmpeg reads from a path anyway.
 */
export async function downloadSharedFileToPath(
  sharedLink: string,
  pathInFolder: string,
  destPath: string,
): Promise<void> {
  const { createWriteStream } = await import('node:fs');
  const { Readable } = await import('node:stream');
  const { pipeline } = await import('node:stream/promises');

  const res = await fetch(`${CONTENT}/sharing/get_shared_link_file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Dropbox-API-Arg': asciiJson({ url: sharedLink, path: pathInFolder }),
    },
  });
  if (!res.ok || !res.body) {
    const text = res.ok ? 'no body' : (await res.text()).slice(0, 300);
    throw retryable(res.status, new Error(`dropbox download ${res.status}: ${text}`));
  }
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(destPath),
  );
}

export function hasDropboxToken(): boolean {
  return hasRefreshToken() || !!process.env.DROPBOX_ACCESS_TOKEN;
}
