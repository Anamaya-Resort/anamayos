import { createServiceClient } from '@/lib/supabase/server';
import { AUDIENCE_DIMENSIONS } from './types';
import type { AudienceBucket, AudienceVM, Platform } from './types';

/**
 * Who follows the account.
 *
 * Kept apart from `queries.ts` because it answers a different kind of
 * question. Everything else on this dashboard is a flow measured over a
 * window; this is a standing picture of the audience as it is right
 * now, so it reads the latest snapshot rather than a date range.
 *
 * Instagram gives these as a lifetime breakdown, caps each dimension at
 * its top entries, and withholds the whole thing below roughly a
 * hundred followers. A missing or thin dimension is therefore normal
 * and the panel says so rather than drawing an empty chart.
 */

/** Age buckets sort naturally; everything else sorts by size. */
const ageRank = (bucket: string): number => {
  const first = parseInt(bucket, 10);
  return Number.isFinite(first) ? first : 999;
};

export async function getAudience(platform: Platform): Promise<AudienceVM> {
  const sb = createServiceClient();
  const empty: AudienceVM = { asOf: null, byDimension: {}, counted: 0 };

  const { data: account } = await sb
    .from('social_accounts')
    .select('id')
    .eq('platform', platform)
    .eq('is_active', true)
    .order('is_sample', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account) return empty;

  // The latest day that has anything, which is not necessarily today:
  // Instagram can withhold the breakdown for a day without warning.
  const { data: latest } = await sb
    .from('social_audience_demographics')
    .select('metric_date')
    .eq('account_id', account.id)
    .order('metric_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest?.metric_date) return empty;

  const { data: rows } = await sb
    .from('social_audience_demographics')
    .select('dimension, bucket, value')
    .eq('account_id', account.id)
    .eq('metric_date', latest.metric_date);

  const grouped: Record<string, AudienceBucket[]> = {};
  let counted = 0;

  for (const dimension of AUDIENCE_DIMENSIONS) {
    const mine = (rows ?? []).filter((r) => r.dimension === dimension);
    if (mine.length === 0) continue;

    const total = mine.reduce((sum, r) => sum + Number(r.value ?? 0), 0);
    counted = Math.max(counted, total);

    grouped[dimension] = mine
      .map((r) => ({
        bucket: String(r.bucket),
        value: Number(r.value ?? 0),
        share: total > 0 ? Number(r.value ?? 0) / total : 0,
      }))
      .sort((a, b) =>
        dimension === 'age'
          ? ageRank(a.bucket) - ageRank(b.bucket)
          : b.value - a.value);
  }

  return { asOf: latest.metric_date as string, byDimension: grouped, counted };
}
