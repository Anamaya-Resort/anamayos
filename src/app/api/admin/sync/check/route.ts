import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchRGPrograms } from '@/lib/retreat-guru';
import { fetchWTTransactions } from '@/lib/wetravel';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sync/check
 *
 * Cheap, read-only "is there anything new?" probe for the dashboard
 * banner. Deliberately NOT the importer: it writes nothing and only
 * pulls the two lists it needs to count differences.
 *
 * Retreat Guru is the source of truth for retreats — we compare its
 * programs to our `retreats` rows by rg_id. WeTravel carries money,
 * not retreats, so its count is new payments, not new retreats.
 *
 * Each source is isolated: if one is down or unconfigured the other
 * still reports, because a dashboard banner must never be the reason
 * the page looks broken.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const [retreatGuru, weTravel] = await Promise.all([
    checkRetreatGuru(supabase),
    checkWeTravel(supabase),
  ]);

  return Response.json({ checkedAt: new Date().toISOString(), retreatGuru, weTravel });
}

type SourceReport = {
  ok: boolean;
  error?: string;
  newCount: number;
  changedCount: number;
  newItems: { id: number; name: string; start_date: string | null }[];
};

async function checkRetreatGuru(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<SourceReport> {
  const empty: SourceReport = { ok: false, newCount: 0, changedCount: 0, newItems: [] };
  try {
    const [programs, { data: rows }] = await Promise.all([
      fetchRGPrograms(),
      supabase.from('retreats').select('rg_id, name, start_date, end_date'),
    ]);

    const byRgId = new Map<number, { name: string | null; start_date: string | null; end_date: string | null }>();
    for (const r of (rows ?? []) as Array<{ rg_id: number | null; name: string | null; start_date: string | null; end_date: string | null }>) {
      if (r.rg_id != null) byRgId.set(r.rg_id, r);
    }

    const newItems: SourceReport['newItems'] = [];
    let changedCount = 0;
    for (const p of programs) {
      const mine = byRgId.get(p.id);
      if (!mine) {
        newItems.push({ id: p.id, name: p.name ?? `Program ${p.id}`, start_date: p.start_date ?? null });
        continue;
      }
      // Only dates and name are compared. Those are what a person
      // would call "an update"; pricing changes ride along on apply.
      if (
        (p.start_date ?? null) !== mine.start_date ||
        (p.end_date ?? null) !== mine.end_date ||
        (p.name ?? '') !== (mine.name ?? '')
      ) changedCount++;
    }

    // Soonest first, so the banner names the most urgent one.
    newItems.sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'));
    return { ok: true, newCount: newItems.length, changedCount, newItems };
  } catch (e) {
    return { ...empty, error: (e as Error).message };
  }
}

async function checkWeTravel(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<SourceReport> {
  const empty: SourceReport = { ok: false, newCount: 0, changedCount: 0, newItems: [] };
  try {
    // The WeTravel importer stores each payment with merchant_trans_id
    // set to the WeTravel uuid, so that is the key to compare on.
    const [txs, { data: rows }] = await Promise.all([
      fetchWTTransactions(),
      supabase
        .from('transactions')
        .select('merchant_trans_id')
        .eq('merchant_name', 'WeTravel')
        .not('merchant_trans_id', 'is', null),
    ]);
    const known = new Set(
      ((rows ?? []) as Array<{ merchant_trans_id: string | null }>).map((r) => r.merchant_trans_id),
    );
    const unseen = txs.filter((t) => !known.has(t.uuid));
    return { ok: true, newCount: unseen.length, changedCount: 0, newItems: [] };
  } catch (e) {
    return { ...empty, error: (e as Error).message };
  }
}
