import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { OccupancyData, OccupancyWeek } from './types';

/**
 * ISO week number, so buckets line up with weekdays across years.
 *
 * Day-of-year bucketing was tried first and produced phantom empty weeks:
 * retreats start on Saturdays, so a 7-day retreat straddles two
 * day-of-year buckets and the chart showed gaps that do not exist.
 */
function isoWeek(d: Date): { year: number; week: number } {
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
 * the calendar year, and a week that strays across the boundary is pinned
 * to the near end of its own year.
 */
function bucket(d: Date): { year: number; week: number } {
  const calendar = d.getUTCFullYear();
  const { year, week } = isoWeek(d);
  if (year > calendar) return { year: calendar, week: 53 };
  if (year < calendar) return { year: calendar, week: 1 };
  return { year, week };
}

/**
 * Reads every row, 1000 at a time.
 *
 * PostgREST caps a response at 1000 rows and says nothing about it. This
 * view spans all history, which is already past that cap, so a single
 * unpaginated select would quietly undercount the earliest years.
 */
async function all<T>(
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

/**
 * How many bookings are in house each week of each year.
 *
 * A booking counts once for every week its retreat runs, so a 3 week
 * teacher training adds 1 to each of 3 weeks while a standard 7 day
 * retreat adds 1 to a single week. The week count comes from the
 * retreat's own start and end dates rather than its name, because the
 * dates already encode the length: 164 retreats are 7 days and the 11
 * that are 21 days are exactly the teacher trainings.
 *
 * Cancelled bookings are excluded. This deliberately ignores the
 * dashboard's date range: it is a seasonality view and only means
 * anything with whole years side by side.
 */
export async function getWeeklyOccupancy(): Promise<OccupancyData> {
  const sb = createServiceClient();

  const [bookings, retreats] = await Promise.all([
    all<{ retreat_id: string | null; status: string | null }>((from, to) =>
      sb.from('bookings').select('retreat_id, status').range(from, to)),
    all<{ id: string; start_date: string | null; end_date: string | null }>((from, to) =>
      sb.from('retreats').select('id, start_date, end_date').range(from, to)),
  ]);

  const byId = new Map(retreats.map((r) => [r.id, r]));
  const counts = new Map<string, number>();
  const years = new Set<string>();
  let guestWeeks = 0;
  let multiWeek = 0;
  let counted = 0;

  for (const b of bookings) {
    if (b.status !== 'confirmed' || !b.retreat_id) continue;
    const r = byId.get(b.retreat_id);
    if (!r?.start_date || !r.end_date) continue;

    const start = new Date(`${r.start_date.slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${r.end_date.slice(0, 10)}T00:00:00Z`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    const spans = Math.max(1, Math.round(days / 7));

    counted += 1;
    if (spans > 1) multiWeek += 1;

    for (let i = 0; i < spans; i += 1) {
      const at = new Date(start.getTime() + i * 7 * 86400000);
      const { year, week } = bucket(at);
      const key = `${year}:${week}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      years.add(String(year));
      guestWeeks += 1;
    }
  }

  const yearList = [...years].sort();
  const weeks: OccupancyWeek[] = [];
  for (let w = 1; w <= 53; w += 1) {
    const row: Record<string, number> = {};
    let any = false;
    for (const y of yearList) {
      const v = counts.get(`${y}:${w}`) ?? 0;
      row[y] = v;
      if (v > 0) any = true;
    }
    if (any || w <= 52) weeks.push({ week: w, counts: row });
  }

  const totals: Record<string, number> = {};
  const activeWeeks: Record<string, number> = {};
  const peak: Record<string, number> = {};
  for (const y of yearList) {
    const vals = weeks.map((w) => w.counts[y] ?? 0);
    totals[y] = vals.reduce((s, v) => s + v, 0);
    activeWeeks[y] = vals.filter((v) => v > 0).length;
    peak[y] = vals.length ? Math.max(...vals) : 0;
  }

  return {
    years: yearList, weeks, totals, activeWeeks, peak,
    guestWeeks, bookingsCounted: counted, multiWeekBookings: multiWeek,
  };
}
