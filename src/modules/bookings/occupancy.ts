import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { allRows, toSeries, weekBucket } from './chart-buckets';
import type { ChartSeriesSet } from './types';

/**
 * How many bookings are in house in each period: when the retreats run.
 *
 * A booking counts once for every week its retreat runs, so a 3 week
 * teacher training adds 1 to each of 3 weeks while a standard 7 day
 * retreat adds 1 to a single week. The span comes from the retreat's own
 * start and end dates rather than its name, because the dates already
 * encode the length: measured on live data 164 retreats are 7 days and
 * the 11 that are 21 days are exactly the teacher trainings.
 *
 * This is the occupancy reading, not the sales reading. A 2027 column has
 * figures in it today because those are bookings already taken for
 * retreats that run in 2027. For when the bookings were actually
 * received, see `getBookingsReceived`.
 *
 * Cancelled bookings are excluded. This deliberately takes no date range:
 * it is a seasonality view and only means anything with whole years side
 * by side.
 */
export async function getOccupancy(): Promise<ChartSeriesSet> {
  const sb = createServiceClient();

  const [bookings, retreats] = await Promise.all([
    allRows<{ retreat_id: string | null; status: string | null }>((from, to) =>
      sb.from('bookings').select('retreat_id, status').range(from, to)),
    allRows<{ id: string; start_date: string | null; end_date: string | null }>((from, to) =>
      sb.from('retreats').select('id, start_date, end_date').range(from, to)),
  ]);

  const byId = new Map(retreats.map((r) => [r.id, r]));
  const monthly = new Map<string, number>();
  const weekly = new Map<string, number>();
  const ytt = new Map<string, number>();
  const years = new Set<string>();
  let guestWeeks = 0;
  let multiWeek = 0;
  let counted = 0;

  const add = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

  for (const b of bookings) {
    if (b.status !== 'confirmed' || !b.retreat_id) continue;
    const r = byId.get(b.retreat_id);
    if (!r?.start_date || !r.end_date) continue;

    const start = new Date(`${r.start_date.slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${r.end_date.slice(0, 10)}T00:00:00Z`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    const spans = Math.max(1, Math.round(days / 7));
    const isTraining = spans > 1;

    counted += 1;
    if (isTraining) multiWeek += 1;

    for (let i = 0; i < spans; i += 1) {
      const at = new Date(start.getTime() + i * 7 * 86400000);
      const year = at.getUTCFullYear();
      add(monthly, `${year}:${at.getUTCMonth() + 1}`);
      if (isTraining) add(ytt, `${year}:${at.getUTCMonth() + 1}`);
      const w = weekBucket(at);
      add(weekly, `${w.year}:${w.week}`);
      years.add(String(year));
      guestWeeks += 1;
    }
  }

  const yearList = [...years].sort();

  return {
    years: yearList,
    monthly: toSeries('month', 12, yearList, monthly),
    weekly: toSeries('week', 53, yearList, weekly),
    ytt: toSeries('month', 12, yearList, ytt),
    stats: { guestWeeks, bookings: counted, multi: multiWeek },
  };
}
