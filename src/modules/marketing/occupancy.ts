import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { OccupancyData, OccupancyMonth } from './types';

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
 * How many bookings are in house each month of each year.
 *
 * A booking counts once for every week its retreat runs, so a 3 week
 * teacher training adds 1 to each of 3 weeks while a standard 7 day
 * retreat adds 1 to a single week. The week count comes from the
 * retreat's own start and end dates rather than its name, because the
 * dates already encode the length: 164 retreats are 7 days and the 11
 * that are 21 days are exactly the teacher trainings.
 *
 * Each of those weeks is then filed under the calendar month its own
 * start date falls in. Monthly buckets sidestep two traps the earlier
 * weekly version had to work around: day-of-year weeks drifted against
 * the Saturday retreat start and showed gaps that did not exist, and ISO
 * weeks disagree with the calendar year at the turn of January, filing a
 * New Year retreat under the previous year.
 *
 * Cancelled bookings are excluded. This deliberately ignores the
 * dashboard's date range: it is a seasonality view and only means
 * anything with whole years side by side.
 */
export async function getMonthlyOccupancy(): Promise<OccupancyData> {
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
      const year = at.getUTCFullYear();
      const month = at.getUTCMonth() + 1;
      const key = `${year}:${month}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      years.add(String(year));
      guestWeeks += 1;
    }
  }

  const yearList = [...years].sort();
  const months: OccupancyMonth[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const row: Record<string, number> = {};
    for (const y of yearList) row[y] = counts.get(`${y}:${m}`) ?? 0;
    months.push({ month: m, counts: row });
  }

  const totals: Record<string, number> = {};
  const activeMonths: Record<string, number> = {};
  const peak: Record<string, number> = {};
  for (const y of yearList) {
    const vals = months.map((m) => m.counts[y] ?? 0);
    totals[y] = vals.reduce((s, v) => s + v, 0);
    activeMonths[y] = vals.filter((v) => v > 0).length;
    peak[y] = vals.length ? Math.max(...vals) : 0;
  }

  return {
    years: yearList, months, totals, activeMonths, peak,
    guestWeeks, bookingsCounted: counted, multiWeekBookings: multiWeek,
  };
}
