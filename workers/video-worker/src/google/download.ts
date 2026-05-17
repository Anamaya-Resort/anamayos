import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

function mediaUrl(fileId: string): URL {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set('alt', 'media');
  url.searchParams.set('supportsAllDrives', 'true');
  return url;
}

/**
 * Download a Drive file's raw bytes. Used to make image
 * proxies/thumbnails (whole file held in memory — fine for images).
 */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
): Promise<Buffer> {
  const res = await fetch(mediaUrl(fileId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Stream a Drive file straight to disk — for videos, which are far
 * too large to hold in a Buffer. ffmpeg then reads the file.
 */
export async function downloadDriveFileToPath(
  accessToken: string,
  fileId: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(mediaUrl(fileId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok || !res.body) {
    throw new Error(
      `Drive download failed: ${res.status} ${res.ok ? 'no body' : await res.text()}`,
    );
  }
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(destPath),
  );
}
