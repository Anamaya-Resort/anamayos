import { BookingsListView, getBookings } from '@/modules/bookings';
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

export default async function BookingsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const [bookings, rooms] = await Promise.all([getBookings(), getRooms()]);

  return <BookingsListView initialBookings={bookings} rooms={rooms} dict={dict} locale={locale} />;
}
