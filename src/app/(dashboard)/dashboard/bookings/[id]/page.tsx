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

    // Fetch retreat info (full data for card display)
    let retreatName: string | null = null;
    let retreatTeacher: string | null = null;
    let retreatData: BookingDetail['retreat_data'] = null;
    const retreatId = bookingRow.retreat_id as string | null;
    if (retreatId) {
      const { data: retreat } = await supabase
        .from('retreats')
        .select('id, name, start_date, end_date, status, categories, excerpt, description, max_capacity, available_spaces, images, feature_image_url, leader_person_id')
        .eq('id', retreatId)
        .single();
      const rr = retreat as Record<string, unknown> | null;
      retreatName = rr?.name as string ?? null;
      const leaderId = rr?.leader_person_id as string | null;
      if (leaderId) {
        const { data: leader } = await supabase.from('persons').select('full_name').eq('id', leaderId).single();
        retreatTeacher = (leader as Record<string, unknown>)?.full_name as string ?? null;
      }
      if (rr) {
        retreatData = {
          id: rr.id as string,
          name: rr.name as string,
          start_date: rr.start_date as string | null,
          end_date: rr.end_date as string | null,
          status: rr.status as string,
          categories: (rr.categories as string[]) ?? [],
          excerpt: rr.excerpt as string | null,
          description: rr.description as string | null,
          max_capacity: rr.max_capacity as number | null,
          available_spaces: rr.available_spaces as number | null,
          images: rr.images,
          teacher: retreatTeacher,
          feature_image_url: rr.feature_image_url as string | null,
        };
      }
    }

    // Fetch room info
    let roomName: string | null = null;
    const roomId = bookingRow.room_id as string | null;
    if (roomId) {
      const { data: room } = await supabase.from('rooms').select('name').eq('id', roomId).single();
      roomName = (room as Record<string, unknown>)?.name as string ?? null;
    }

    // Fetch lodging type name
    let lodgingTypeName: string | null = null;
    const lodgingTypeId = bookingRow.lodging_type_id as string | null;
    if (lodgingTypeId) {
      const { data: lodging } = await supabase.from('lodging_types').select('name').eq('id', lodgingTypeId).single();
      lodgingTypeName = (lodging as Record<string, unknown>)?.name as string ?? null;
    }

    // Fetch room layout for room viewer
    let layoutJson: Record<string, unknown> | null = null;
    let layoutUnit = 'meters';
    let roomBeds: Array<{ id: string; label: string; bedType: string; capacity: number }> = [];
    if (roomId) {
      const { data: layout } = await supabase.from('room_layouts').select('layout_json, unit').eq('room_id', roomId).single();
      if (layout) {
        layoutJson = (layout as Record<string, unknown>).layout_json as Record<string, unknown>;
        layoutUnit = (layout as Record<string, unknown>).unit as string ?? 'meters';
      }
      const { data: beds } = await supabase.from('beds').select('id, label, bed_type, capacity').eq('room_id', roomId).eq('is_active', true);
      roomBeds = ((beds ?? []) as Array<Record<string, unknown>>).map((b) => ({
        id: b.id as string, label: b.label as string, bedType: b.bed_type as string, capacity: (b.capacity as number) ?? 1,
      }));
    }

    // Fetch transactions for payment history
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, trans_date, class, category, status, description, charge_amount, credit_amount, grand_total')
      .eq('booking_id', id)
      .order('trans_date', { ascending: true });

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
      retreat_name: retreatName,
      retreat_teacher: retreatTeacher,
      retreat_data: retreatData,
      room_name: roomName,
      lodging_type_name: lodgingTypeName,
      layout_json: layoutJson,
      layout_unit: layoutUnit,
      room_beds: roomBeds,
      transactions: (transactions ?? []) as Array<{ id: string; trans_date: string | null; class: string; category: string; status: string; description: string | null; charge_amount: number; credit_amount: number; grand_total: number }>,
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

  return <BookingDetailView booking={booking} rooms={rooms} dict={dict} locale={locale} />;
}
