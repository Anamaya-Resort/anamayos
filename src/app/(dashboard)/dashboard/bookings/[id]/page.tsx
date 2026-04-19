import { notFound } from 'next/navigation';
import { BookingDetailView } from '@/modules/bookings';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { BookingDetail } from '@/modules/bookings';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Booking Detail — AO Platform' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getBooking(id: string): Promise<BookingDetail | null> {
  if (!UUID_RE.test(id)) return null;

  try {
    const supabase = createServiceClient();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !booking) return null;

    const bookingRow = booking as Record<string, unknown>;
    const personId = bookingRow.person_id as string;

    const { data: person } = await supabase
      .from('persons')
      .select('full_name, email, phone, gender, country, city, nationality, whatsapp_number, date_of_birth, pronouns, communication_preference')
      .eq('id', personId)
      .single();

    const personRow = person as { full_name: string | null; email: string; phone?: string; gender?: string; country?: string; city?: string; nationality?: string; whatsapp_number?: string; date_of_birth?: string; pronouns?: string; communication_preference?: string } | null;

    const { data: participants } = await supabase
      .from('booking_participants')
      .select('*')
      .eq('booking_id', id)
      .order('is_primary', { ascending: false });

    return {
      ...(bookingRow as unknown as BookingDetail),
      guest_name: personRow?.full_name ?? null,
      guest_email: personRow?.email ?? '',
      guest_phone: personRow?.phone ?? null,
      guest_gender: personRow?.gender ?? null,
      guest_country: personRow?.country ?? null,
      guest_city: personRow?.city ?? null,
      guest_nationality: personRow?.nationality ?? null,
      guest_whatsapp: personRow?.whatsapp_number ?? null,
      guest_dob: personRow?.date_of_birth ?? null,
      participants: (participants ?? []) as BookingDetail['participants'],
    };
  } catch {
    return null;
  }
}

async function getRooms(): Promise<Array<{ id: string; name: string }>> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from('rooms').select('id, name').eq('is_active', true).order('sort_order');
    return (data ?? []) as Array<{ id: string; name: string }>;
  } catch {
    return [];
  }
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const [booking, rooms] = await Promise.all([getBooking(id), getRooms()]);

  if (!booking) notFound();

  return <BookingDetailView booking={booking} rooms={rooms} dict={dict} />;
}
