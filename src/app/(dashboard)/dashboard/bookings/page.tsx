import { BookingsListView } from '@/modules/bookings';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { BookingListItem } from '@/modules/bookings';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Bookings — AO Platform' };

async function getBookings(): Promise<BookingListItem[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('*, persons(full_name, email)')
      .order('check_in', { ascending: false })
      .limit(2000);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => {
      const person = row.persons as { full_name: string | null; email: string } | null;
      return {
        ...(row as unknown as BookingListItem),
        guest_name: person?.full_name ?? null,
        guest_email: person?.email ?? '',
      };
    });
  } catch {
    return [];
  }
}

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

  return <BookingsListView initialBookings={bookings} rooms={rooms} dict={dict} />;
}
