import type { MetricCounts, Post } from './types';

/**
 * The metric registry.
 *
 * One place that knows what a metric is called, how it is computed from
 * raw counters, how it is formatted, and whether up is good. Every chart
 * and tile reads from here, so adding "skip rate" when a platform starts
 * reporting it is one entry, not a sweep through ten components.
 *
 * Why rates and not totals, for anything that compares groups: if you
 * publish 40 yoga posts and 4 biohacking posts, totals will always say
 * yoga wins. Rate per post is the only honest comparison, which is why
 * every comparison metric below is a rate and why the charts print the
 * post count beside the bar.
 *
 * Two deliberate absences. There is no `impressions`: Meta deprecated it
 * in July 2024 and removed it in April 2025, and `views` replaced it. And
 * `followersTotal` is not a metric here, only a chart axis -- a number
 * that only ever goes up measures nothing.
 */

export type MetricFormat = 'integer' | 'percent' | 'seconds' | 'decimal';

export interface MetricDef {
  id: string;
  /** Key under the `social.metric` i18n namespace. */
  labelKey: string;
  format: MetricFormat;
  /** False when a lower number is the better outcome. */
  higherIsBetter: boolean;
  /** Computed from a bundle of raw counters. Null when not measurable. */
  compute: (m: MetricCounts) => number | null;
}

const rate = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export const METRICS: Record<string, MetricDef> = {
  views: {
    id: 'views', labelKey: 'views', format: 'integer', higherIsBetter: true,
    compute: (m) => m.views,
  },
  reach: {
    id: 'reach', labelKey: 'reach', format: 'integer', higherIsBetter: true,
    compute: (m) => m.reach,
  },
  nonFollowerReachPct: {
    id: 'nonFollowerReachPct', labelKey: 'nonFollowerReachPct',
    format: 'percent', higherIsBetter: true,
    // The growth signal. Reach alone says nothing: reach to people who
    // do not follow you yet is what makes the account bigger.
    compute: (m) => rate(m.nonFollowerReach, m.reach),
  },
  engagementRate: {
    id: 'engagementRate', labelKey: 'engagementRate',
    format: 'percent', higherIsBetter: true,
    // Engagement rate BY REACH, not by followers. Follower-based rates
    // flatter a small account and punish a post that travelled.
    compute: (m) => rate(m.likes + m.comments + m.saves + m.shares, m.reach),
  },
  saveRate: {
    id: 'saveRate', labelKey: 'saveRate', format: 'percent', higherIsBetter: true,
    // Saves and shares are what the ranking model weights most heavily,
    // well above likes. This is the headline quality metric.
    compute: (m) => rate(m.saves, m.reach),
  },
  shareRate: {
    id: 'shareRate', labelKey: 'shareRate', format: 'percent', higherIsBetter: true,
    compute: (m) => rate(m.shares, m.reach),
  },
  profileVisitRate: {
    id: 'profileVisitRate', labelKey: 'profileVisitRate',
    format: 'percent', higherIsBetter: true,
    compute: (m) => rate(m.profileVisits, m.reach),
  },
  followRate: {
    id: 'followRate', labelKey: 'followRate', format: 'percent', higherIsBetter: true,
    compute: (m) => rate(m.follows, m.reach),
  },
  linkClickRate: {
    id: 'linkClickRate', labelKey: 'linkClickRate',
    format: 'percent', higherIsBetter: true,
    compute: (m) => rate(m.linkClicks, m.reach),
  },
  saves: {
    id: 'saves', labelKey: 'saves', format: 'integer', higherIsBetter: true,
    compute: (m) => m.saves,
  },
  shares: {
    id: 'shares', labelKey: 'shares', format: 'integer', higherIsBetter: true,
    compute: (m) => m.shares,
  },
  profileVisits: {
    id: 'profileVisits', labelKey: 'profileVisits', format: 'integer', higherIsBetter: true,
    compute: (m) => m.profileVisits,
  },
  linkClicks: {
    id: 'linkClicks', labelKey: 'linkClicks', format: 'integer', higherIsBetter: true,
    compute: (m) => m.linkClicks,
  },
  avgWatchSeconds: {
    id: 'avgWatchSeconds', labelKey: 'avgWatchSeconds',
    format: 'seconds', higherIsBetter: true,
    compute: (m) => m.videoAvgWatchSeconds,
  },
};

/** The metrics offered in the comparison switchers. All rates, by design. */
export const COMPARISON_METRIC_IDS = [
  'saveRate', 'shareRate', 'engagementRate', 'nonFollowerReachPct',
  'profileVisitRate', 'followRate',
] as const;

export const EMPTY_COUNTS: MetricCounts = {
  views: 0, reach: 0, nonFollowerReach: 0, likes: 0, comments: 0,
  saves: 0, shares: 0, follows: 0, profileVisits: 0, linkClicks: 0,
  videoAvgWatchSeconds: null,
};

/** Add counter bundles together. Watch time averages rather than sums. */
export function sumCounts(all: MetricCounts[]): MetricCounts {
  const out: MetricCounts = { ...EMPTY_COUNTS };
  let watchTotal = 0;
  let watchCount = 0;
  for (const m of all) {
    out.views += m.views;
    out.reach += m.reach;
    out.nonFollowerReach += m.nonFollowerReach;
    out.likes += m.likes;
    out.comments += m.comments;
    out.saves += m.saves;
    out.shares += m.shares;
    out.follows += m.follows;
    out.profileVisits += m.profileVisits;
    out.linkClicks += m.linkClicks;
    if (m.videoAvgWatchSeconds !== null) {
      watchTotal += m.videoAvgWatchSeconds;
      watchCount += 1;
    }
  }
  out.videoAvgWatchSeconds = watchCount > 0 ? watchTotal / watchCount : null;
  return out;
}

export const sumPosts = (posts: Post[]): MetricCounts =>
  sumCounts(posts.map((p) => p.totals));

/** Metric value across a group of posts, pooled rather than averaged. */
export function metricOf(metricId: string, posts: Post[]): number | null {
  const def = METRICS[metricId];
  if (!def || posts.length === 0) return null;
  return def.compute(sumPosts(posts));
}

export function formatMetric(
  value: number | null, format: MetricFormat, locale: string,
): string {
  if (value === null || !Number.isFinite(value)) return '—';
  switch (format) {
    case 'percent':
      return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
    case 'seconds':
      return `${value.toFixed(1)}s`;
    case 'decimal':
      return value.toFixed(2);
    default:
      return new Intl.NumberFormat(locale, { notation: value >= 10000 ? 'compact' : 'standard' })
        .format(Math.round(value));
  }
}

export const formatById = (
  metricId: string, value: number | null, locale: string,
): string => formatMetric(value, METRICS[metricId]?.format ?? 'integer', locale);

/** Percent change between two values. Null when the base is unusable. */
export function change(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null;
  return (now - before) / Math.abs(before);
}
