import { syncStories } from '@/modules/social/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/cron/social-stories
 *
 * Every four hours (see vercel.json). Stories are gone 24 hours after
 * they are posted, insights included, and nothing can recover one that
 * expired before it was read. The nightly post sync would miss most of
 * them, so this runs on its own and does only this.
 *
 * Returns 200 with `connected: false` when no token is saved yet, which
 * is the normal state before the account is connected rather than a
 * failure.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await syncStories();
    return Response.json({ startedAt, finishedAt: new Date().toISOString(), ...result });
  } catch (e) {
    return Response.json({ startedAt, error: (e as Error).message }, { status: 500 });
  }
}
