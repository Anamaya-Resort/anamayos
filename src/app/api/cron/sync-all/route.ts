import { createServiceClient } from '@/lib/supabase/server';
import { importWeTravelTransactions } from '@/lib/wetravel-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/sync-all
 *
 * Runs the full sync automatically -- no one has to open Settings and
 * click a button. Vercel Cron (see vercel.json) hits this on a schedule
 * and sends `Authorization: Bearer <CRON_SECRET>` automatically once
 * CRON_SECRET is set as a project env var; without that var set, this
 * route refuses every request (including a real cron hit), so the sync
 * silently not running is the visible failure mode, not an open endpoint.
 *
 * Runs BOTH sources every time, same as the dashboard's manual "Update"
 * button, so bookings/people/leads/transactions (only the full Retreat
 * Guru import touches those) and WeTravel payments never go stale again
 * waiting on someone to remember to click something.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const startedAt = new Date().toISOString();

  // Retreat Guru — the full incremental import (rooms, lodgings, teachers,
  // people, retreats, room_blocks, bookings, leads, transactions). Runs via
  // an internal call to the existing streaming route so there's exactly
  // one place that knows how to do this import, cron or not; we drain the
  // stream to completion rather than parse it line by line -- sync_jobs
  // already has the full per-step detail if anyone needs it.
  let retreatGuru: { ok: boolean; status?: number; error?: string };
  try {
    const res = await fetch(`${origin}/api/admin/import/retreat-guru?mode=incremental`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    await res.text();
    retreatGuru = { ok: res.ok, status: res.status };
  } catch (e) {
    retreatGuru = { ok: false, error: (e as Error).message };
  }

  // WeTravel — direct call, no HTTP round trip needed for a plain function.
  let weTravel: { ok: boolean; imported?: number; skipped?: number; errors?: number; error?: string };
  try {
    const supabase = createServiceClient();
    const wt = await importWeTravelTransactions(supabase);
    weTravel = { ok: wt.errors.length === 0, imported: wt.imported, skipped: wt.skipped, errors: wt.errors.length };
  } catch (e) {
    weTravel = { ok: false, error: (e as Error).message };
  }

  return Response.json({ startedAt, finishedAt: new Date().toISOString(), retreatGuru, weTravel });
}
