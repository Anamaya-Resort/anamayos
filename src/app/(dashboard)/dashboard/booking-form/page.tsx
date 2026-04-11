import { BookingFormDocument } from '@/modules/booking-form';
import { fetchRoomData } from '@/modules/rooms';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Booking Form — AO Platform' };

export default async function BookingFormPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch upcoming retreats only (start_date >= today)
  const { data: retreatsData } = await supabase
    .from('retreats')
    .select('id, name, start_date, end_date, categories, max_capacity, available_spaces, currency, deposit_percentage, excerpt, images, status, registration_status, leader_person_id, persons!retreats_leader_person_id_fkey(full_name)')
    .eq('is_active', true)
    .in('status', ['confirmed', 'draft'])
    .gte('start_date', today)
    .order('start_date', { ascending: true });

  const retreats = (retreatsData ?? []).map((r: Record<string, unknown>) => {
    const leader = r.persons as { full_name: string } | null;
    const images = r.images as Array<Record<string, unknown>> | null;
    // Try to get a thumbnail from the images array
    let imageUrl: string | null = null;
    if (images && images.length > 0) {
      const first = images[0];
      imageUrl = (first.thumbnail as Record<string, unknown>)?.url as string
        ?? (first.medium as Record<string, unknown>)?.url as string
        ?? (first.url as string)
        ?? null;
    }

    return {
      id: r.id as string,
      name: r.name as string,
      start_date: r.start_date as string | null,
      end_date: r.end_date as string | null,
      categories: (r.categories as string[]) ?? [],
      max_capacity: (r.max_capacity as number) ?? null,
      available_spaces: (r.available_spaces as number) ?? null,
      currency: (r.currency as string) ?? 'USD',
      deposit_percentage: (r.deposit_percentage as number) ?? 50,
      leader_name: leader?.full_name ?? null,
      image_url: imageUrl,
      status: r.status as string,
    };
  });

  // Fetch rooms using shared module
  const rooms = await fetchRoomData();

  return <BookingFormDocument dict={dict} retreats={retreats} rooms={rooms} />;
}
