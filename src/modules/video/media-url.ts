/**
 * Public URLs for library media.
 *
 * The video-proxies bucket is public-read: anyone may look, only the
 * service role may write. That is deliberate - the whole point of the
 * collection is that Anamaya's photographs get seen - and it removes
 * a real constraint. Signed URLs expired after an hour, which meant a
 * public page could not cache one and every listing spent a round
 * trip minting them in batches.
 *
 * These URLs are permanent and CDN-cacheable.
 *
 * Worth being clear about the trade: anything in the bucket is
 * reachable by whoever holds its URL. Paths carry a random uuid so
 * they are not guessable, but "unlisted" is not "private". The review
 * and permission gate therefore governs which images a page SHOWS,
 * not which files exist.
 */
const BUCKET = 'video-proxies';

function base(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url.replace(/\/+$/, '');
}

export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${base()}/storage/v1/object/public/${BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
