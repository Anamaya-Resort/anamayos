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
      .select('*, persons(full_name, email), rooms(name), retreats(name)')
      .order('check_in', { ascending: false })
      .limit(2000);

    if (error || !data) return [];

    const mapped = data.map((row: Record<string, unknown>) => {
      const person = row.persons as { full_name: string | null; email: string } | null;
      const room = row.rooms as { name: string } | null;
      const retreat = row.retreats as { name: string } | null;
      return {
        ...(row as unknown as BookingListItem),
        guest_name: person?.full_name ?? null,
        guest_email: person?.email ?? '',
        room_name: room?.name ?? null,
        retreat_name: retreat?.name ?? null,
        is_sub_booking: !!(row.rg_parent_booking_id as number),
        guest_type: (row.guest_type as string) ?? 'participant',
        _rg_id: (row.rg_id as number) ?? null,
        _rg_parent_id: (row.rg_parent_booking_id as number) ?? null,
      };
    });

    // Group sub-bookings under their parent so they appear together
    const parentMap = new Map<number, typeof mapped>();
    const result: BookingListItem[] = [];
    const subs: typeof mapped = [];

    for (const b of mapped) {
      if (b._rg_parent_id) {
        subs.push(b);
      } else {
        result.push(b);
        if (b._rg_id) {
          if (!parentMap.has(b._rg_id)) parentMap.set(b._rg_id, []);
        }
      }
    }

    // Insert subs after their parent
    const final: BookingListItem[] = [];
    for (const b of result) {
      final.push(b);
      const bWithRgId = b as typeof mapped[0];
      if (bWithRgId._rg_id) {
        const children = subs.filter((s) => s._rg_parent_id === bWithRgId._rg_id);
        final.push(...children);
        // Remove placed children
        for (const c of children) {
          const idx = subs.indexOf(c);
          if (idx >= 0) subs.splice(idx, 1);
        }
      }
    }
    // Append any orphaned subs at the end
    final.push(...subs);

    return final;
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
