import 'server-only';
import type { ChartBucket, ChartSeries } from './types';

/**
 * ISO week number, so weekly buckets line up with weekdays across years.
 *
 * Day-of-year bucketing was tried first and produced phantom empty weeks:
 * retreats start on Saturdays, so a 7 day retreat straddles two
 * day-of-year buckets and the chart showed gaps that do not exist.
 */
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

/**
 * Which year-and-week column a date belongs in.
 *
 * ISO weeks give the weekday alignment we want, but an ISO year can
 * disagree with the calendar year at the turn of January: 2027-01-02 is
 * ISO week 53 of 2026, which would file a New Year retreat under the
 * previous year and quietly understate the newest year. So the column is
 * always the calendar year, and a week that strays across the boundary is
 * pinned to the near end of its own year. The monthly views do not need
 * this: a calendar month comes straight off the date.
 */
export function weekBucket(d: Date): { year: number; week: number } {
  const calendar = d.getUTCFullYear();
  const { year, week } = isoWeek(d);
  if (year > calendar) return { year: calendar, week: 53 };
  if (year < calendar) return { year: calendar, week: 1 };
  return { year, week };
}

/**
 * Reads every row, 1000 at a time.
 *
 * PostgREST caps a response at 1000 rows and says nothing about it. These
 * queries span all history, which is already past that cap, so a single
 * unpaginated select would quietly undercount the earliest years.
 */
export async function allRows<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data } = await run(from, from + page - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

/** Turns a `${year}:${n}` tally into the shape the chart draws. */
export function toSeries(
  kind: 'month' | 'week',
  size: number,
  years: string[],
  counts: Map<string, number>,
): ChartSeries {
  const buckets: ChartBucket[] = [];
  for (let n = 1; n <= size; n += 1) {
    const row: Record<string, number> = {};
    for (const y of years) row[y] = counts.get(`${y}:${n}`) ?? 0;
    buckets.push({ n, counts: row });
  }
  const totals: Record<string, number> = {};
  const peak: Record<string, number> = {};
  for (const y of years) {
    const vals = buckets.map((b) => b.counts[y] ?? 0);
    totals[y] = vals.reduce((s, v) => s + v, 0);
    peak[y] = vals.length ? Math.max(...vals) : 0;
  }
  return { kind, buckets, totals, peak };
}
