import { sendWeeklyReport } from '@/modules/social/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/cron/social-report
 *
 * Mondays at 7am Costa Rica time (see vercel.json). Emails last week's
 * summary to whoever is listed under `report_recipients` for instagram
 * in the connections panel.
 *
 * Returns 200 with `sent: false` and a reason when there are no
 * recipients or no mail key. Neither is a failure: both are the normal
 * state until somebody asks for the report, and a red cron would be
 * noise.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await sendWeeklyReport();
    return Response.json({ startedAt, finishedAt: new Date().toISOString(), ...result });
  } catch (e) {
    return Response.json({ startedAt, error: (e as Error).message }, { status: 500 });
  }
}
