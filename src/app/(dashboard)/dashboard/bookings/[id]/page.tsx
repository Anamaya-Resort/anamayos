import { notFound } from 'next/navigation';
import { BookingDetailView } from '@/modules/bookings';
import { getDictionary } from '@/i18n';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { BookingDetail } from '@/modules/bookings';

export const metadata = { title: 'Booking Detail — AO Platform' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getBooking(id: string): Promise<BookingDetail | null> {
  if (!UUID_RE.test(id)) return null;

  try {
    const supabase = await createServerSupabaseClient();

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
      .select('full_name, email')
      .eq('id', personId)
      .single();

    const personRow = person as { full_name: string | null; email: string } | null;

    const { data: participants } = await supabase
      .from('booking_participants')
      .select('*')
      .eq('booking_id', id)
      .order('is_primary', { ascending: false });

    return {
      ...(bookingRow as unknown as BookingDetail),
      guest_name: personRow?.full_name ?? null,
      guest_email: personRow?.email ?? '',
      participants: (participants ?? []) as BookingDetail['participants'],
    };
  } catch {
    return null;
  }
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dict = getDictionary('en');
  const booking = await getBooking(id);

  if (!booking) notFound();

  return <BookingDetailView booking={booking} dict={dict} />;
}
