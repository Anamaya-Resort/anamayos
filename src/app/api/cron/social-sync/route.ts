import { syncInstagram } from '@/modules/social/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/social-sync
 *
 * Daily (see vercel.json). Takes one snapshot of Instagram: recent
 * posts, their figures as of today, and the account's own day.
 *
 * The timing matters more than it looks. These tables record a day at a
 * time and the history cannot be rebuilt afterwards, because every
 * platform only ever reports a post's total as of now. A day this job
 * misses is a hole in the record permanently, which is why it runs
 * nightly rather than on demand.
 *
 * Returns 200 with `connected: false` when no token is saved yet. That
 * is not a failure: it is the normal state before the account is
 * connected, and a red cron in the dashboard would be noise.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await syncInstagram();
    return Response.json({ startedAt, finishedAt: new Date().toISOString(), ...result });
  } catch (e) {
    return Response.json(
      { startedAt, error: (e as Error).message },
      { status: 500 },
    );
  }
}
