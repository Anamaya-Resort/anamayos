import { METRICS, sumPosts } from './metrics';
import type { Pillar, Post, PostFormat } from './types';

/**
 * Grouping and bucketing. Pure functions over posts, no platform
 * knowledge, no React, so each one is cheap to reason about and reuse.
 *
 * Every function that feeds a comparison takes only matured posts, which
 * is enforced by `matured()` rather than left to each caller to
 * remember.
 */

/** Posts old enough to be compared fairly. See `Post.maturedTotals`. */
export const matured = (posts: Post[]): Post[] =>
  posts.filter((p) => p.maturedTotals !== null);

/** Replaces lifetime totals with the maturity-window ones, for comparing. */
export const onMaturity = (posts: Post[]): Post[] =>
  matured(posts).map((p) => ({ ...p, totals: p.maturedTotals! }));

export interface Group {
  key: string;
  label: string;
  colorSlot: number;
  posts: Post[];
  value: number | null;
}

/** Group by primary pillar. Posts with no pillar fall into `unclassified`. */
export function byPillar(
  posts: Post[], pillars: Pillar[], metricId: string, unclassifiedLabel: string,
): Group[] {
  const def = METRICS[metricId];
  const groups: Group[] = pillars
    .filter((p) => p.slug !== 'unclassified')
    .map((p) => ({
      key: p.id, label: p.name, colorSlot: p.colorSlot,
      posts: posts.filter((x) => x.pillarId === p.id), value: null,
    }));

  const unknown = posts.filter(
    (x) => !x.pillarId || !pillars.some((p) => p.id === x.pillarId && p.slug !== 'unclassified'),
  );
  if (unknown.length > 0) {
    const bucket = pillars.find((p) => p.slug === 'unclassified');
    groups.push({
      key: bucket?.id ?? 'unclassified',
      label: bucket?.name ?? unclassifiedLabel,
      colorSlot: bucket?.colorSlot ?? 5,
      posts: unknown, value: null,
    });
  }

  for (const g of groups) {
    g.value = g.posts.length > 0 && def ? def.compute(sumPosts(g.posts)) : null;
  }
  return groups;
}

export function byFormat(
  posts: Post[], formats: PostFormat[], metricId: string,
): Group[] {
  const def = METRICS[metricId];
  return formats.map((f, i) => {
    const mine = posts.filter((p) => p.format === f);
    return {
      key: f, label: f, colorSlot: i + 1, posts: mine,
      value: mine.length > 0 && def ? def.compute(sumPosts(mine)) : null,
    };
  });
}

/** ISO week key, e.g. "2026-W07". Weeks start Monday. */
export function weekKey(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(
    ((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7,
  );
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export const monthKey = (isoDate: string): string => isoDate.slice(0, 7);

/**
 * Bucket posts into consecutive periods and compute a metric per period.
 *
 * Empty periods are kept as null rather than dropped, so a gap in
 * posting shows as a gap instead of being smoothed over.
 */
export function series(
  posts: Post[], metricId: string, bucket: (iso: string) => string,
  keys: string[],
): Array<{ x: string; y: number | null; n: number }> {
  const def = METRICS[metricId];
  const grouped = new Map<string, Post[]>();
  for (const p of posts) {
    const k = bucket(p.publishedAt);
    const list = grouped.get(k);
    if (list) list.push(p);
    else grouped.set(k, [p]);
  }
  return keys.map((k) => {
    const mine = grouped.get(k) ?? [];
    return {
      x: k,
      y: mine.length > 0 && def ? def.compute(sumPosts(mine)) : null,
      n: mine.length,
    };
  });
}

/** Every bucket key between two dates, inclusive, with no gaps. */
export function bucketKeys(
  from: string, to: string, bucket: (iso: string) => string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (
    let t = Date.parse(`${from}T00:00:00Z`);
    t <= Date.parse(`${to}T00:00:00Z`);
    t += 86400000
  ) {
    const k = bucket(new Date(t).toISOString().slice(0, 10));
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

export interface TimingCell {
  day: number;
  hourBand: string;
  value: number | null;
  n: number;
}

/**
 * Posting-time grid: day of week by 4-hour band.
 *
 * Four-hour bands rather than 24 hourly columns because a year of
 * posting at five a week gives about 250 posts, and 168 hourly cells
 * would hold one post each, which is noise wearing a heatmap's clothes.
 *
 * Bucketed in the account's own timezone, not UTC. A retreat in Costa
 * Rica posting at 7am local lands at 13:00 UTC, and a UTC grid would
 * tell you to post in the afternoon.
 */
export function byPostingTime(
  posts: Post[], metricId: string, timeZone: string, bands: string[],
): TimingCell[] {
  const def = METRICS[metricId];
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: 'numeric', hour12: false,
  });
  const dayIndex: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };

  const buckets = new Map<string, Post[]>();
  for (const p of posts) {
    const parts = fmt.formatToParts(new Date(p.publishedAt));
    const wd = parts.find((x) => x.type === 'weekday')?.value ?? 'Mon';
    const hr = Number(parts.find((x) => x.type === 'hour')?.value ?? '0');
    const day = dayIndex[wd] ?? 0;
    const band = bands[Math.min(Math.floor(hr / 4), bands.length - 1)];
    const k = `${day}|${band}`;
    const list = buckets.get(k);
    if (list) list.push(p);
    else buckets.set(k, [p]);
  }

  const cells: TimingCell[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (const band of bands) {
      const mine = buckets.get(`${day}|${band}`) ?? [];
      cells.push({
        day, hourBand: band, n: mine.length,
        value: mine.length > 0 && def ? def.compute(sumPosts(mine)) : null,
      });
    }
  }
  return cells;
}

/** Top and bottom N by a metric, from matured posts only. */
export function extremes(
  posts: Post[], metricId: string, n: number,
): { top: Post[]; bottom: Post[] } {
  const def = METRICS[metricId];
  if (!def) return { top: [], bottom: [] };
  const scored = posts
    .map((p) => ({ p, v: def.compute(p.totals) }))
    .filter((x): x is { p: Post; v: number } => x.v !== null && Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v);
  return {
    top: scored.slice(0, n).map((x) => x.p),
    bottom: scored.slice(-n).reverse().map((x) => x.p),
  };
}
