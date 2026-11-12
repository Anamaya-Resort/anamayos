import { COMPARISON_METRIC_IDS, METRICS, change, sumPosts } from './metrics';
import {
  bucketKeys, byPillar, byPostingTime, extremes, monthKey, onMaturity, series, weekKey,
} from './aggregate';
import { FORMAT_ORDER } from './theme';
import { HOUR_BANDS } from './labels';
import type { Campaign, DateRange, Pillar, Post, PostFormat } from './types';

/**
 * Server-computed view models, one per interactive panel.
 *
 * This file exists for a measured reason. Six of the panels are client
 * components, because each carries a metric switcher. Passing the post
 * array into all six meant React serialised 335 posts into the page six
 * separate times, and the response came to 1.2 MB -- the same bug that
 * made /dashboard/bookings take fifteen seconds.
 *
 * So the server does the arithmetic once, for every metric the switcher
 * offers, and sends the answers. Switching metric is then an index
 * lookup in the browser rather than a recomputation, the payload drops
 * to a fraction of the size, and the panels become dumb renderers that
 * will take data from any platform or any other source.
 *
 * Precomputing every metric variant is cheap because these are all
 * small: a handful of pillars by a handful of metrics. The thing that
 * was expensive was the raw posts, and none of them are here.
 */

const METRIC_IDS = [...COMPARISON_METRIC_IDS];

/** Panel 3 — pillar comparison. */
export interface PillarCompareVM {
  immature: number;
  /** metric id -> one row per pillar, sorted best first. */
  byMetric: Record<string, Array<{
    key: string;
    label: string;
    colorSlot: number;
    value: number | null;
    posts: number;
    /** The four metrics the always-visible table shows. */
    table: Record<string, number | null>;
    reach: number;
  }>>;
}

const TABLE_METRICS = ['saveRate', 'shareRate', 'engagementRate', 'nonFollowerReachPct'];

export function pillarCompareVM(
  posts: Post[], pillars: Pillar[], unclassifiedLabel: string,
): PillarCompareVM {
  const ready = onMaturity(posts);
  const byMetric: PillarCompareVM['byMetric'] = {};

  for (const metricId of METRIC_IDS) {
    byMetric[metricId] = byPillar(ready, pillars, metricId, unclassifiedLabel)
      .filter((g) => g.posts.length > 0)
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
      .map((g) => {
        const counts = sumPosts(g.posts);
        const table: Record<string, number | null> = {};
        for (const id of TABLE_METRICS) table[id] = METRICS[id].compute(counts);
        return {
          key: g.key, label: g.label, colorSlot: g.colorSlot,
          value: g.value, posts: g.posts.length, table, reach: counts.reach,
        };
      });
  }

  return { immature: posts.length - ready.length, byMetric };
}

/** Panel 4 — one trend line per pillar. */
export interface PillarTrendVM {
  monthly: boolean;
  byMetric: Record<string, Array<{
    key: string;
    label: string;
    colorSlot: number;
    posts: number;
    points: Array<{ x: string; y: number | null }>;
  }>>;
}

export function pillarTrendVM(
  posts: Post[], pillars: Pillar[], range: DateRange, unclassifiedLabel: string,
): PillarTrendVM {
  // Weekly for short windows, monthly past roughly four months, so a
  // bucket always holds enough posts to mean something.
  const monthly = range.days > 120;
  const bucket = monthly ? monthKey : weekKey;
  const keys = bucketKeys(range.from, range.to, bucket);
  const short = (k: string) => (monthly ? k.slice(2) : k.replace(/^\d{4}-/, ''));

  const ready = onMaturity(posts);
  const byMetric: PillarTrendVM['byMetric'] = {};

  for (const metricId of METRIC_IDS) {
    byMetric[metricId] = byPillar(ready, pillars, metricId, unclassifiedLabel)
      // Fewer than three comparable posts is noise, not a trend.
      .filter((g) => g.posts.length >= 3)
      .map((g) => ({
        key: g.key, label: g.label, colorSlot: g.colorSlot, posts: g.posts.length,
        points: series(g.posts, metricId, bucket, keys)
          .map((pt) => ({ x: short(pt.x), y: pt.y })),
      }));
  }

  return { monthly, byMetric };
}

/** Panel 6 — format against pillar. */
export interface MatrixVM {
  rows: PostFormat[];
  cols: Array<{ id: string; name: string }>;
  byMetric: Record<string, Array<{
    row: string; col: string; value: number | null; n: number;
  }>>;
}

export function formatMatrixVM(posts: Post[], pillars: Pillar[]): MatrixVM {
  const ready = onMaturity(posts);
  const cols = pillars
    .filter((pl) => pl.slug !== 'unclassified' && ready.some((x) => x.pillarId === pl.id))
    .map((pl) => ({ id: pl.id, name: pl.name }));

  const byMetric: MatrixVM['byMetric'] = {};
  for (const metricId of METRIC_IDS) {
    const cells: MatrixVM['byMetric'][string] = [];
    for (const f of FORMAT_ORDER) {
      for (const col of cols) {
        const mine = ready.filter((x) => x.format === f && x.pillarId === col.id);
        cells.push({
          row: f, col: col.id, n: mine.length,
          value: mine.length > 0 ? METRICS[metricId].compute(sumPosts(mine)) : null,
        });
      }
    }
    byMetric[metricId] = cells;
  }
  return { rows: [...FORMAT_ORDER], cols, byMetric };
}

/** Panel 9 — day of week against time of day. */
export interface TimingVM {
  byMetric: Record<string, Array<{
    row: string; col: string; value: number | null; n: number;
  }>>;
}

export function timingVM(posts: Post[], timeZone: string): TimingVM {
  const ready = onMaturity(posts);
  const byMetric: TimingVM['byMetric'] = {};
  for (const metricId of METRIC_IDS) {
    byMetric[metricId] = byPostingTime(ready, metricId, timeZone, HOUR_BANDS)
      .map((c) => ({ row: String(c.day), col: c.hourBand, value: c.value, n: c.n }));
  }
  return { byMetric };
}

/** Panel 5 — each campaign against its own baseline. */
export interface CampaignVM {
  id: string;
  name: string;
  slug: string;
  startsOn: string;
  endsOn: string;
  notes: string | null;
  accentSlot: number;
  pillarNames: string[];
  duringPosts: number;
  baselinePosts: number;
  /** True when the baseline is too small for the change column to mean much. */
  thinBaseline: boolean;
  baselineFrom: string;
  baselineTo: string;
  rows: Array<{ metricId: string; now: number | null; before: number | null; lift: number | null }>;
}

export function campaignVMs(
  campaigns: Campaign[], allPosts: Post[], pillars: Pillar[],
): CampaignVM[] {
  const ready = onMaturity(allPosts);

  return campaigns.map((c) => {
    const start = Date.parse(`${c.startsOn}T00:00:00Z`);
    const end = Date.parse(`${c.endsOn}T23:59:59Z`);
    const baseStart = start - (end - start) - 86400000;

    // The baseline is the SAME pillars in the run-up. Comparing a
    // biohacking push against all content would mostly measure the
    // difference between subjects, not what the push achieved.
    const inPillars = (post: Post) =>
      c.pillarIds.length === 0 || post.pillarIds.some((id) => c.pillarIds.includes(id));

    const during = ready.filter((x) => {
      const t = Date.parse(x.publishedAt);
      return t >= start && t <= end && inPillars(x);
    });
    const baseline = ready.filter((x) => {
      const t = Date.parse(x.publishedAt);
      return t >= baseStart && t < start && inPillars(x);
    });

    const nowCounts = sumPosts(during);
    const beforeCounts = sumPosts(baseline);

    return {
      id: c.id, name: c.name, slug: c.slug,
      startsOn: c.startsOn, endsOn: c.endsOn, notes: c.notes,
      accentSlot: c.accentSlot,
      pillarNames: c.pillarIds
        .map((id) => pillars.find((x) => x.id === id)?.name)
        .filter((x): x is string => Boolean(x)),
      duringPosts: during.length,
      baselinePosts: baseline.length,
      // Same floor as the heatmaps use. A one-post baseline produces a
      // confident-looking percentage that is pure noise, and this panel
      // is the one most likely to be quoted at someone.
      thinBaseline: baseline.length < 5,
      baselineFrom: new Date(baseStart).toISOString().slice(0, 10),
      baselineTo: new Date(start - 86400000).toISOString().slice(0, 10),
      rows: METRIC_IDS.map((metricId) => {
        const now = during.length ? METRICS[metricId].compute(nowCounts) : null;
        const before = baseline.length ? METRICS[metricId].compute(beforeCounts) : null;
        return { metricId, now, before, lift: change(now, before) };
      }),
    };
  });
}

/** Panel 7 — one slim row per post. */
export interface PostRowVM {
  id: string;
  publishedAt: string;
  ageDays: number;
  caption: string;
  format: PostFormat;
  pillarId: string | null;
  pillarIds: string[];
  pillarName: string;
  permalink: string | null;
  needsReview: boolean;
  views: number;
  reach: number;
  saves: number;
  nonFollowerReachPct: number | null;
  saveRate: number | null;
  shareRate: number | null;
  engagementRate: number | null;
}

/** Captions are truncated here: the table clamps them to one line anyway. */
const CAPTION_MAX = 140;

export function postRowVMs(posts: Post[], pillars: Pillar[]): PostRowVM[] {
  const names = new Map(pillars.map((p) => [p.id, p.name]));
  return posts.map((p) => ({
    id: p.id,
    publishedAt: p.publishedAt,
    ageDays: p.ageDays,
    caption: (p.caption ?? '').slice(0, CAPTION_MAX),
    format: p.format,
    pillarId: p.pillarId,
    pillarIds: p.pillarIds,
    pillarName: p.pillarId ? names.get(p.pillarId) ?? '—' : '—',
    permalink: p.permalink,
    needsReview: p.classifiedBy === 'auto' && p.confidence !== null && p.confidence < 0.7,
    views: p.totals.views,
    reach: p.totals.reach,
    saves: p.totals.saves,
    nonFollowerReachPct: METRICS.nonFollowerReachPct.compute(p.totals),
    saveRate: METRICS.saveRate.compute(p.totals),
    shareRate: METRICS.shareRate.compute(p.totals),
    engagementRate: METRICS.engagementRate.compute(p.totals),
  }));
}

/** Panel 8 — best and worst, by save rate. */
export function extremeVMs(
  posts: Post[], pillars: Pillar[], n = 5,
): { top: PostRowVM[]; bottom: PostRowVM[] } {
  const { top, bottom } = extremes(onMaturity(posts), 'saveRate', n);
  return {
    top: postRowVMs(top, pillars),
    bottom: postRowVMs(bottom, pillars),
  };
}
