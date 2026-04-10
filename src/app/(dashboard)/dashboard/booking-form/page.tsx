import { BookingFormDocument } from '@/modules/booking-form';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Booking Form — AO Platform' };

export default async function BookingFormPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  // Fetch retreats for the dropdown
  const { data: retreatsData } = await supabase
    .from('retreats')
    .select('id, name, start_date, end_date')
    .eq('is_active', true)
    .in('status', ['confirmed', 'draft'])
    .order('start_date', { ascending: true });

  const retreats = (retreatsData ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    start_date: r.start_date as string | null,
    end_date: r.end_date as string | null,
  }));

  // Fetch rooms
  const { data: roomsData } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy, is_shared')
    .eq('is_active', true)
    .order('sort_order');

  const rooms = (roomsData ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    maxOccupancy: (r.max_occupancy as number) ?? 2,
    isShared: (r.is_shared as boolean) ?? false,
  }));

  return <BookingFormDocument dict={dict} retreats={retreats} rooms={rooms} />;
}
