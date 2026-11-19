import 'server-only';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pool } from './snapshot';

/**
 * Keeps a copy of each post's thumbnail.
 *
 * Instagram's image URLs are signed and expire within days. Storing the
 * one the API hands back makes a post table that looks right the day it
 * syncs and is full of broken images a week later, which is worse than
 * showing no image at all. So the picture is fetched once, shrunk, and
 * kept in our own bucket.
 *
 * Deliberately incremental: a run caches a limited number of the newest
 * uncached posts rather than trying to do a whole back catalogue inside
 * one function invocation. Repeated runs converge.
 */

const BUCKET = 'social-thumbs';

/** Wide enough for a retina table row, small enough to cost nothing. */
const WIDTH = 320;

/** Per run. A first backfill catches up over several nights. */
const DEFAULT_BATCH = 80;

let bucketChecked = false;

async function ensureBucket(sb: SupabaseClient): Promise<void> {
  if (bucketChecked) return;
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
    });
  }
  bucketChecked = true;
}

/** True once the URL points at our own storage rather than Instagram. */
const isCached = (url: string | null): boolean =>
  !!url && url.includes(`/storage/v1/object/public/${BUCKET}/`);

export interface ThumbnailResult {
  considered: number;
  cached: number;
  failed: number;
}

export async function cacheThumbnails(
  sb: SupabaseClient,
  accountId: string,
  opts: { batch?: number; deadline?: number } = {},
): Promise<ThumbnailResult> {
  const out: ThumbnailResult = { considered: 0, cached: 0, failed: 0 };
  const batch = opts.batch ?? DEFAULT_BATCH;
  const deadline = opts.deadline ?? Date.now() + 120_000;

  const { data: rows } = await sb
    .from('social_posts')
    .select('id, thumbnail_url')
    .eq('account_id', accountId)
    .not('thumbnail_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(batch * 4);

  const todo = (rows ?? [])
    .filter((r) => !isCached(r.thumbnail_url as string | null))
    .slice(0, batch);

  out.considered = todo.length;
  if (todo.length === 0) return out;

  await ensureBucket(sb);

  await pool(todo, 4, async (row) => {
    if (Date.now() > deadline) return;
    try {
      const res = await fetch(row.thumbnail_url as string, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) { out.failed += 1; return; }

      const webp = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(WIDTH, WIDTH, { fit: 'cover', position: 'attention' })
        .webp({ quality: 78 })
        .toBuffer();

      const path = `${accountId}/${row.id}.webp`;
      const { error } = await sb.storage.from(BUCKET).upload(path, webp, {
        contentType: 'image/webp',
        upsert: true,
      });
      if (error) { out.failed += 1; return; }

      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
      await sb.from('social_posts')
        .update({ thumbnail_url: pub.publicUrl })
        .eq('id', row.id);
      out.cached += 1;
    } catch {
      // A dead Instagram URL is expected on older posts and is not worth
      // an error row; the post simply renders without a picture.
      out.failed += 1;
    }
  });

  return out;
}
