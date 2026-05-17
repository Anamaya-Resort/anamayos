/**
 * Upload generated proxies/thumbnails to the private video-proxies
 * bucket. Path layout: {org_id}/{asset_id}/{name}.
 */
import { db } from './db.js';

const BUCKET = 'video-proxies';

export async function uploadProxy(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`storage upload failed (${path}): ${error.message}`);
  return path;
}
