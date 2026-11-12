import { syncRetreatAvailability } from '@/lib/retreat-availability';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/retreat-availability
 *
 * Hourly (see vercel.json). Refreshes each upcoming retreat's availability
 * from Retreat Guru: the API's yes/no capacity flag plus the room-by-room
 * open/sold-out list from its booking form. Feeds /api/public/upcoming-retreats.
 *
 * Protected by CRON_SECRET (Vercel Cron sends it automatically).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  try {
    const result = await syncRetreatAvailability();
    return Response.json({ startedAt, finishedAt: new Date().toISOString(), ...result });
  } catch (e) {
    return Response.json({ startedAt, error: (e as Error).message }, { status: 500 });
  }
}
