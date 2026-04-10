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

  // Fetch rooms with group, rate, category, beds
  const { data: roomsData } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy, is_shared, base_rate_per_night, currency, room_group, description, room_categories(name), beds(id, label, bed_type, is_active, sort_order)')
    .eq('is_active', true)
    .order('sort_order');

  const rooms = (roomsData ?? []).map((r: Record<string, unknown>) => {
    const cat = r.room_categories as { name: string } | null;
    const bedsRaw = (r.beds as Array<Record<string, unknown>>) ?? [];
    const beds = bedsRaw
      .filter((b) => b.is_active !== false)
      .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      .map((b) => ({ label: b.label as string, bedType: b.bed_type as string }));

    return {
      id: r.id as string,
      name: r.name as string,
      maxOccupancy: (r.max_occupancy as number) ?? 2,
      isShared: (r.is_shared as boolean) ?? false,
      ratePerNight: (r.base_rate_per_night as number) ?? null,
      currency: (r.currency as string) ?? 'USD',
      roomGroup: (r.room_group as string) ?? 'other',
      category: cat?.name ?? '',
      description: (r.description as string) ?? null,
      beds,
    };
  });

  return <BookingFormDocument dict={dict} retreats={retreats} rooms={rooms} />;
}
