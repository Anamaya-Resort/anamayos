import { PageHeader } from '@/components/shared';
import { BookingsTabs } from './bookings-tabs';
import { BookingsBarChart } from './bookings-bar-chart';
import type { ChartSeriesSet } from './types';
import type { TranslationKeys } from '@/i18n/en';

/**
 * The Charts section of Bookings. One panel per chart, stacked, so
 * further charts drop in below without reflowing the ones above.
 *
 * The two charts answer two different questions and are easy to confuse,
 * which is why the sales one comes first: "received" is when the money
 * came in, "in house" is when the guests are on site. A column for next
 * year is empty on the first and full on the second, and both are right.
 */
export function BookingsChartsView({
  received, occupancy, locale, dict,
}: {
  received: ChartSeriesSet; occupancy: ChartSeriesSet;
  locale: string; dict: TranslationKeys;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={dict.bookings.title} description={dict.bookings.chartsDesc} />
      <BookingsTabs active="charts" dict={dict} />
      <BookingsBarChart data={received} copy={dict.bookings.received} locale={locale} />
      <BookingsBarChart data={occupancy} copy={dict.bookings.occupancy} locale={locale} />
    </div>
  );
}
