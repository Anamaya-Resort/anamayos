import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type {
  CreativeRow, DashRange, GoalProgress, GoalWithProgress, Kpi, MarketingGoal,
  MarketingPlatform, OutcomeTotals, PlatformKey, PlatformSummary, RetreatOutcome,
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

  const [bookingsRes, soldRes, paidRes, leadsRes] = await Promise.all([
    sb.from('bookings')
      .select('id, total_amount, currency, created_at')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`),
    // What was SOLD. Line items carry charge_amount and are the only rows
    // reliably tied to a retreat.
    sb.from('transactions')
      .select('charge_amount, discount_amount, currency, trans_date')
      .eq('class', 'item')
      .gte('trans_date', range.from)
      .lte('trans_date', range.to),
    // What was COLLECTED. Payment rows carry grand_total. Payouts
    // (wire_transfer) are money going out and are excluded on purpose.
    sb.from('transactions')
      .select('grand_total, trans_date')
      .in('class', ['card_payment', 'non_cc_payment'])
      .gte('trans_date', range.from)
      .lte('trans_date', range.to),
    sb.from('leads')
      .select('id, created_at')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`),
  ]);

  const bookings = bookingsRes.data ?? [];
  const sold = soldRes.data ?? [];
  const paid = paidRes.data ?? [];
  const leads = leadsRes.data ?? [];

  const revenue = sold.reduce(
    (sum, t) => sum + Number(t.charge_amount ?? 0) - Number(t.discount_amount ?? 0),
    0,
  );
  const collected = paid.reduce((sum, t) => sum + Number(t.grand_total ?? 0), 0);
  const withAmount = bookings.filter((b) => Number(b.total_amount ?? 0) > 0);
  const bookedValue = withAmount.reduce((s, b) => s + Number(b.total_amount ?? 0), 0);

  return {
    bookings: bookings.length,
    bookingsWithAmount: withAmount.length,
    revenue,
    collected,
    averageBookingValue: withAmount.length ? bookedValue / withAmount.length : null,
    leads: leads.length,
    leadToBookingRate: leads.length ? bookings.length / leads.length : null,
    currency: (sold[0]?.currency as string) ?? 'USD',
    revenueFreshAt: maxOf(sold.map((t) => t.trans_date as string | null)),
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
  const [{ data: sold }, { data: bookings }, { data: retreats }] = await Promise.all([
    sb.from('transactions')
      .select('retreat_id, charge_amount, discount_amount')
      .eq('class', 'item')
      .gte('trans_date', range.from)
      .lte('trans_date', range.to)
      .not('retreat_id', 'is', null),
    sb.from('bookings')
      .select('retreat_id')
      .gte('created_at', range.from)
      .lte('created_at', `${range.to}T23:59:59`)
      .not('retreat_id', 'is', null),
    sb.from('retreats').select('id, name, start_date'),
  ]);

  const byId = new Map((retreats ?? []).map((r) => [r.id as string, r]));
  const totals = new Map<string, { bookings: number; revenue: number }>();

  for (const t of sold ?? []) {
    const id = t.retreat_id as string;
    const cur = totals.get(id) ?? { bookings: 0, revenue: 0 };
    cur.revenue += Number(t.charge_amount ?? 0) - Number(t.discount_amount ?? 0);
    totals.set(id, cur);
  }
  for (const b of bookings ?? []) {
    const id = b.retreat_id as string;
    const cur = totals.get(id) ?? { bookings: 0, revenue: 0 };
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

/**
 * Active goals with their targets measured against live figures.
 *
 * A goal scoped to a platform only counts when that platform's tab is
 * open. Spend and ROAS stay null until a connector feeds `ad_spend_daily`,
 * so the bar renders as "no data" rather than 0% of target.
 */
export async function getGoals(
  platform: PlatformKey,
  range: DashRange,
  outcomes: OutcomeTotals,
  summary: PlatformSummary,
): Promise<GoalWithProgress[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('marketing_goals')
    .select('*')
    .eq('is_active', true)
    .or(`platform_key.is.null,platform_key.eq.${platform}`)
    .order('period_start', { ascending: false })
    .limit(6);

  const spend = summary.kpis.find((x) => x.key === 'spend')?.value ?? null;
  const roas = summary.kpis.find((x) => x.key === 'roas')?.value ?? null;

  return (data ?? []).map((g) => {
    const goal = g as MarketingGoal;
    const progress: GoalProgress[] = [];
    const add = (key: string, target: number | null, actual: number | null, format: Kpi['format']) => {
      if (target !== null && Number(target) > 0) {
        progress.push({ key, target: Number(target), actual, format });
      }
    };
    add('spend', goal.target_spend, spend, 'currency');
    add('leads', goal.target_leads, outcomes.leads, 'number');
    add('bookings', goal.target_bookings, outcomes.bookings, 'number');
    add('revenue', goal.target_revenue, outcomes.revenue, 'currency');
    add('roas', goal.target_roas, roas, 'ratio');
    return { goal, progress };
  });
}

/**
 * Ad-level performance for the open tab. Empty until a connector runs;
 * the table renders its own waiting state rather than disappearing, so
 * the page shape stays stable once data arrives.
 */
export async function getCreatives(
  platform: PlatformKey,
  placement: string,
  range: DashRange,
  limit = 15,
): Promise<CreativeRow[]> {
  const sb = createServiceClient();

  let q = sb.from('ad_spend_daily')
    .select('ad_external_id, campaign_external_id, spend, impressions, clicks, platform_leads, platform_conversions')
    .eq('platform_key', platform)
    .gte('stat_date', range.from)
    .lte('stat_date', range.to);
  if (placement !== 'all') q = q.eq('placement', placement);

  const { data: rows } = await q;
  if (!rows?.length) return [];

  const totals = new Map<string, CreativeRow>();
  for (const r of rows) {
    // Fall back to the campaign when a platform reports no ad id, so the
    // row is still attributable rather than silently dropped.
    const id = (r.ad_external_id as string | null) ?? (r.campaign_external_id as string | null);
    if (!id) continue;
    const cur = totals.get(id) ?? {
      externalId: id, name: id, level: 'ad' as const, status: null,
      spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0,
    };
    cur.spend += Number(r.spend ?? 0);
    cur.impressions += Number(r.impressions ?? 0);
    cur.clicks += Number(r.clicks ?? 0);
    cur.leads += Number(r.platform_leads ?? 0);
    cur.conversions += Number(r.platform_conversions ?? 0);
    totals.set(id, cur);
  }

  const { data: entities } = await sb
    .from('ad_entities')
    .select('external_id, name, level, status')
    .eq('platform_key', platform)
    .in('external_id', [...totals.keys()]);

  for (const e of entities ?? []) {
    const row = totals.get(e.external_id as string);
    if (!row) continue;
    row.name = (e.name as string) ?? row.externalId;
    row.level = (e.level as CreativeRow['level']) ?? row.level;
    row.status = (e.status as string) ?? null;
  }

  return [...totals.values()].sort((a, b) => b.spend - a.spend).slice(0, limit);
}
