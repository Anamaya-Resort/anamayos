import { PageHeader } from '@/components/shared';
import { BookingsTabs } from './bookings-tabs';
import { OccupancyChart } from './occupancy-chart';
import type { OccupancyData } from './types';
import type { TranslationKeys } from '@/i18n/en';

/**
 * The Charts section of Bookings. One panel per chart, stacked, so
 * further charts drop in below the occupancy one without reflowing it.
 */
export function BookingsChartsView({
  occupancy, locale, dict,
}: {
  occupancy: OccupancyData; locale: string; dict: TranslationKeys;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={dict.bookings.title} description={dict.bookings.chartsDesc} />
      <BookingsTabs active="charts" dict={dict} />
      <OccupancyChart data={occupancy} locale={locale} dict={dict} />
    </div>
  );
}
