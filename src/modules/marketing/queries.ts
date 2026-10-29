import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type {
  DashRange, Kpi, MarketingPlatform, OutcomeTotals, PlatformKey,
  PlatformSummary, RetreatOutcome,
} from './types';

/** Default window: the trailing 30 days, inclusive of today. */
export function defaultRange(): DashRange {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  return { from: iso(from), to: iso(to), label: 'last30' };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getPlatforms(): Promise<MarketingPlatform[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('marketing_platforms')
    .select('key, name, sort_order, logo_slug, placements, is_active')
    .eq('is_active', true)
    .order('sort_order');
  return (data ?? []) as MarketingPlatform[];
}

/**
 * Business outcomes straight out of AnamayOS. These are real today and do
 * not depend on any ad platform being connected.
 *
 * Revenue comes from `transactions.grand_total` rather than bookings,
 * because a booking's headline amount is what was quoted while
 * transactions are what actually moved.
 */
export async function getOutcomes(range: DashRange): Promise<OutcomeTotals> {
  const sb = createServiceClient();

  const [bookingsRes, txnRes, leadsRes] = await Promise.all([
    sb.from('bookings')
      .select('id, total_amount, currency, created_at')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`),
    sb.from('transactions')
      .select('grand_total, currency, trans_date')
      .gte('trans_date', range.from)
      .lte('trans_date', range.to),
    sb.from('leads')
      .select('id, created_at')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`),
  ]);

  const bookings = bookingsRes.data ?? [];
  const txns = txnRes.data ?? [];
  const leads = leadsRes.data ?? [];

  const revenue = txns.reduce((sum, t) => sum + Number(t.grand_total ?? 0), 0);
  const withAmount = bookings.filter((b) => Number(b.total_amount ?? 0) > 0);
  const bookedValue = withAmount.reduce((s, b) => s + Number(b.total_amount ?? 0), 0);

  return {
    bookings: bookings.length,
    bookingsWithAmount: withAmount.length,
    revenue,
    averageBookingValue: withAmount.length ? bookedValue / withAmount.length : null,
    leads: leads.length,
    leadToBookingRate: leads.length ? bookings.length / leads.length : null,
    currency: (txns[0]?.currency as string) ?? 'USD',
    revenueFreshAt: maxOf(txns.map((t) => t.trans_date as string | null)),
    bookingsFreshAt: maxOf(bookings.map((b) => b.created_at as string | null)),
  };
}

function maxOf(values: (string | null)[]): string | null {
  const clean = values.filter(Boolean) as string[];
  return clean.length ? clean.sort().at(-1)! : null;
}

/** Revenue and bookings grouped by retreat — their real business unit. */
export async function getRetreatOutcomes(range: DashRange, limit = 12): Promise<RetreatOutcome[]> {
  const sb = createServiceClient();
  const [{ data: txns }, { data: retreats }] = await Promise.all([
    sb.from('transactions')
      .select('retreat_id, grand_total')
      .gte('trans_date', range.from)
      .lte('trans_date', range.to)
      .not('retreat_id', 'is', null),
    sb.from('retreats').select('id, name, start_date'),
  ]);

  const byId = new Map((retreats ?? []).map((r) => [r.id as string, r]));
  const totals = new Map<string, { bookings: number; revenue: number }>();
  for (const t of txns ?? []) {
    const id = t.retreat_id as string;
    const cur = totals.get(id) ?? { bookings: 0, revenue: 0 };
    cur.revenue += Number(t.grand_total ?? 0);
    cur.bookings += 1;
    totals.set(id, cur);
  }

  return [...totals.entries()]
    .map(([retreatId, v]) => ({
      retreatId,
      name: (byId.get(retreatId)?.name as string) ?? 'Unknown retreat',
      startDate: (byId.get(retreatId)?.start_date as string) ?? null,
      bookings: v.bookings,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Per-platform figures. Spend-derived metrics stay null until a connector
 * writes into `ad_spend_daily`, and each one names what is blocking it so
 * the tile can say so out loud.
 */
export async function getPlatformSummary(
  platform: PlatformKey,
  placement: string,
  range: DashRange,
  outcomes: OutcomeTotals,
): Promise<PlatformSummary> {
  const sb = createServiceClient();

  let spendQ = sb.from('ad_spend_daily')
    .select('spend, impressions, clicks, platform_leads, platform_conversions, platform_revenue, synced_at')
    .eq('platform_key', platform)
    .gte('stat_date', range.from)
    .lte('stat_date', range.to);
  if (placement !== 'all') spendQ = spendQ.eq('placement', placement);

  const [{ data: rows }, { data: sync }] = await Promise.all([
    spendQ,
    sb.from('marketing_sync_log')
      .select('finished_at, status')
      .eq('platform_key', platform)
      .order('started_at', { ascending: false })
      .limit(1),
  ]);

  const spendRows = rows ?? [];
  const connected = spendRows.length > 0;
  const spend = spendRows.reduce((s, r) => s + Number(r.spend ?? 0), 0);
  const platformLeads = spendRows.reduce((s, r) => s + Number(r.platform_leads ?? 0), 0);
  const freshAt = maxOf(spendRows.map((r) => (r.synced_at as string | null)?.slice(0, 10) ?? null));
  const noSpend = 'spendNotConnected';

  const kpis: Kpi[] = [
    k('spend', connected ? spend : null, 'currency', 'platform', freshAt, noSpend),
    k('leads', connected && platformLeads > 0 ? platformLeads : outcomes.leads, 'number',
      connected && platformLeads > 0 ? 'platform' : 'anamayos', freshAt ?? outcomes.bookingsFreshAt),
    k('cpl', connected && outcomes.leads > 0 ? spend / outcomes.leads : null, 'currency', 'blended', freshAt, noSpend),
    k('bookings', outcomes.bookings, 'number', 'anamayos', outcomes.bookingsFreshAt),
    k('costPerBooking', connected && outcomes.bookings > 0 ? spend / outcomes.bookings : null,
      'currency', 'blended', freshAt, noSpend),
    k('revenue', outcomes.revenue, 'currency', 'anamayos', outcomes.revenueFreshAt),
    k('roas', connected && spend > 0 ? outcomes.revenue / spend : null, 'ratio', 'blended', freshAt, noSpend),
    k('leadToBooking', outcomes.leadToBookingRate, 'percent', 'anamayos', outcomes.bookingsFreshAt),
  ];

  return {
    platform,
    placement,
    kpis,
    connected,
    lastSyncAt: (sync?.[0]?.finished_at as string) ?? null,
  };
}

function k(
  key: string, value: number | null, format: Kpi['format'],
  source: Kpi['source'], freshAt: string | null, blockedBy?: string,
): Kpi {
  return { key, value, format, source, freshAt, ...(value === null && blockedBy ? { blockedBy } : {}) };
}
