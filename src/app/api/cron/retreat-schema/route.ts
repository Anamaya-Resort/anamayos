import { syncRetreatSchema } from '@/lib/retreat-schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/retreat-schema
 *
 * Hourly (see vercel.json). Pushes Event + AggregateOffer JSON-LD for every
 * upcoming retreat into its anamaya.com page, so search engines and AI agents
 * can recommend specific retreats with dates and prices. Reads the retreats
 * already synced from Retreat Guru; writes nothing if WP creds are missing.
 *
 * Protected by CRON_SECRET (Vercel Cron sends it automatically). Without that
 * env var set, every request is refused.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeaderValue = request.headers.get('authorization');
  if (!cronSecret || authHeaderValue !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await syncRetreatSchema();
    return Response.json({ startedAt, finishedAt: new Date().toISOString(), ...result });
  } catch (e) {
    return Response.json({ startedAt, error: (e as Error).message }, { status: 500 });
  }
}
