import {
  BookingsListView, BookingsTabs, BookingsChartsView,
  getBookings, getOccupancy, getBookingsReceived,
} from '@/modules/bookings';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Bookings — AO Platform' };

async function getRooms(): Promise<Array<{ id: string; name: string }>> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order');
    return (data ?? []) as Array<{ id: string; name: string }>;
  } catch {
    return [];
  }
}

/**
 * Bookings has two sections. The list is the default; charts live behind
 * `?tab=charts` so the list never pays for the all-history occupancy
 * query, which reads every booking and retreat ever recorded.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const { tab } = await searchParams;

  if (tab === 'charts') {
    const [received, occupancy] = await Promise.all([
      getBookingsReceived(),
      getOccupancy(),
    ]);
    return (
      <BookingsChartsView
        received={received} occupancy={occupancy} locale={locale} dict={dict}
      />
    );
  }

  const [bookings, rooms] = await Promise.all([getBookings(), getRooms()]);

  return (
    <BookingsListView
      initialBookings={bookings}
      rooms={rooms}
      dict={dict}
      locale={locale}
      tabs={<BookingsTabs active="list" dict={dict} />}
    />
  );
}
