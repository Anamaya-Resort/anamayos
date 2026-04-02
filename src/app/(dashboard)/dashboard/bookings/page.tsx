import { BookingsListView } from '@/modules/bookings';
import { getDictionary } from '@/i18n';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { BookingListItem } from '@/modules/bookings';

export const metadata = { title: 'Bookings — AO Platform' };

async function getBookings(): Promise<BookingListItem[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return [];

    return (data as unknown as BookingListItem[]).map((row) => ({
      ...row,
      guest_name: null,
      guest_email: '',
    }));
  } catch {
    // Table may not exist yet during initial setup
    return [];
  }
}

export default async function BookingsPage() {
  const dict = getDictionary('en');
  const bookings = await getBookings();

  return <BookingsListView initialBookings={bookings} dict={dict} />;
}
