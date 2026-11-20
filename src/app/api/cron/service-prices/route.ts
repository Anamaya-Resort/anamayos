import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/service-prices
 *
 * Daily, just after midnight Costa Rica time (see vercel.json). Switches on
 * any scheduled price changes whose date has arrived: copies them from
 * service_price_changes into service_catalog (which the website's spa page
 * reads live) and the linked products. Safe to re-run; see migration 00069.
 *
 * Protected by CRON_SECRET (Vercel Cron sends it automatically).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data, error } = await createServiceClient().rpc('apply_due_service_price_changes');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ applied: data ?? 0, ranAt: new Date().toISOString() });
}
