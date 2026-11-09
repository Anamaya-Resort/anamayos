import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { allRows, toSeries, weekBucket } from './chart-buckets';
import type { ChartSeriesSet } from './types';

/**
 * When bookings actually came in: the sales reading, not occupancy.
 *
 * Each confirmed booking counts once, on the day it was taken. A teacher
 * training is one booking here, not three: the count-it-once-per-week rule
 * belongs to the occupancy chart, where it answers how many people are on
 * site. This chart answers how many sales were made.
 *
 * ## Which date this uses, and why
 *
 * It uses `bookings.created_at`, the moment the booking was taken, which
 * for a retreat is also the moment the deposit is paid.
 *
 * The obvious alternative is the first payment row in `transactions`.
 * Measured on live data that is the worse source: payment rows exist for
 * only 791 of 1,187 confirmed bookings (66%), fewer than half carry a
 * `booking_id` so the rest have to be matched by person plus retreat, and
 * the table holds payments dating back to 2020, well before booking
 * records start. Building the chart on it would understate every month by
 * a third and understate it unevenly.
 *
 * Where a clean payment row does exist, the two agree: of 393 bookings
 * with a card or bank payment linked directly, 382 took their first
 * payment on the same day the booking was created.
 *
 * `created_at` was also checked for being an import timestamp rather than
 * a real booking date, which is a trap elsewhere in this schema
 * (`retreats.created_at` *is* an import timestamp). It is not. The proof
 * is `rg_id`, Retreat Guru's own sequential booking number: sorted by
 * `created_at`, `rg_id` goes backwards only once in 1,186 steps, so this
 * column really does track the order bookings were made upstream. An
 * import stamp would have scrambled it.
 *
 * ## The one caveat, which the footnote states
 *
 * Retreat Guru's own numbering starts at 1 in early 2024, so Feb and Mar
 * 2024 hold bookings that already existed and were entered when it went
 * live. Their fingerprint is the lead time: Feb 2024 bookings have a
 * median of 8 days from booking to check-in with 18 of 62 inside a week,
 * against a median of 60 to 150 days in every later month. The dates are
 * genuine data-entry dates, but those two months are not comparable sales
 * months. April 2024 onward is.
 *
 * Cancelled bookings are excluded. No date range, for the same reason as
 * the occupancy chart.
 */
export async function getBookingsReceived(): Promise<ChartSeriesSet> {
  const sb = createServiceClient();

  const [bookings, retreats] = await Promise.all([
    allRows<{
      retreat_id: string | null; status: string | null; created_at: string | null;
    }>((from, to) =>
      sb.from('bookings').select('retreat_id, status, created_at').range(from, to)),
    allRows<{ id: string; start_date: string | null; end_date: string | null }>((from, to) =>
      sb.from('retreats').select('id, start_date, end_date').range(from, to)),
  ]);

  /** Retreat ids that run longer than a week, i.e. the teacher trainings. */
  const trainings = new Set(
    retreats
      .filter((r) => {
        if (!r.start_date || !r.end_date) return false;
        const days = Math.round(
          (new Date(`${r.end_date.slice(0, 10)}T00:00:00Z`).getTime()
            - new Date(`${r.start_date.slice(0, 10)}T00:00:00Z`).getTime()) / 86400000,
        );
        return Math.max(1, Math.round(days / 7)) > 1;
      })
      .map((r) => r.id),
  );

  const monthly = new Map<string, number>();
  const weekly = new Map<string, number>();
  const ytt = new Map<string, number>();
  const years = new Set<string>();
  let counted = 0;
  let yttCount = 0;
  let undated = 0;

  const add = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

  for (const b of bookings) {
    if (b.status !== 'confirmed') continue;
    if (!b.created_at) { undated += 1; continue; }

    const at = new Date(`${b.created_at.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(at.getTime())) { undated += 1; continue; }

    const year = at.getUTCFullYear();
    const month = at.getUTCMonth() + 1;
    add(monthly, `${year}:${month}`);
    const w = weekBucket(at);
    add(weekly, `${w.year}:${w.week}`);
    years.add(String(year));
    counted += 1;

    if (b.retreat_id && trainings.has(b.retreat_id)) {
      add(ytt, `${year}:${month}`);
      yttCount += 1;
    }
  }

  const yearList = [...years].sort();

  return {
    years: yearList,
    monthly: toSeries('month', 12, yearList, monthly),
    weekly: toSeries('week', 53, yearList, weekly),
    ytt: toSeries('month', 12, yearList, ytt),
    stats: { bookings: counted, ytt: yttCount, undated },
  };
}
