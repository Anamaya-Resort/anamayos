import { CalendarGrid } from '@/modules/calendar';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { CalendarRoom, CalendarBooking, CalendarRoomBlock } from '@/modules/calendar';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Calendar — AO Platform' };

/**
 * Room display order — Upper rooms first, then Lower rooms.
 * Rooms not in this list appear at the end.
 */
const UPPER_ROOMS = ['Casita', 'Garuda Tower', 'Anahata Room', 'Bali Cabina', 'Jungle Cabina', 'Prana Cabina', 'Lotus Cabina', 'Temple'];
const LOWER_ROOMS = ['Gaia Cabina', 'Ananda Cabina', 'Hanuman Room', 'Ganesh Room', 'Shiva Room', 'Mantra Room', 'Dharma Room'];

function sortRooms(rooms: CalendarRoom[]): { group: string; rooms: CalendarRoom[] }[] {
  const roomOrder = new Map<string, number>();
  UPPER_ROOMS.forEach((name, i) => roomOrder.set(name.toLowerCase(), i));
  LOWER_ROOMS.forEach((name, i) => roomOrder.set(name.toLowerCase(), 100 + i));

  const upper: CalendarRoom[] = [];
  const lower: CalendarRoom[] = [];
  const other: CalendarRoom[] = [];

  for (const room of rooms) {
    const nameLower = room.name.toLowerCase();
    if (UPPER_ROOMS.some((u) => nameLower.includes(u.toLowerCase().split(' ')[0]))) {
      upper.push(room);
    } else if (LOWER_ROOMS.some((l) => nameLower.includes(l.toLowerCase().split(' ')[0]))) {
      lower.push(room);
    } else {
      other.push(room);
    }
  }

  // Sort within each group by the predefined order
  const sortByOrder = (a: CalendarRoom, b: CalendarRoom) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aOrder = [...roomOrder.entries()].find(([k]) => aName.includes(k.split(' ')[0]))?.[1] ?? 999;
    const bOrder = [...roomOrder.entries()].find(([k]) => bName.includes(k.split(' ')[0]))?.[1] ?? 999;
    return aOrder - bOrder;
  };

  upper.sort(sortByOrder);
  lower.sort(sortByOrder);

  const groups: { group: string; rooms: CalendarRoom[] }[] = [];
  if (upper.length > 0) groups.push({ group: 'upper', rooms: upper });
  if (lower.length > 0) groups.push({ group: 'lower', rooms: lower });
  if (other.length > 0) groups.push({ group: 'other', rooms: other });

  return groups;
}

export default async function CalendarPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const { data: roomsData } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy, is_shared, base_rate_per_night, currency, category_id, room_categories(name)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const rooms: CalendarRoom[] = (roomsData ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    maxOccupancy: (r.max_occupancy as number) ?? 2,
    category: ((r.room_categories as Record<string, unknown>)?.name as string) ?? '',
    ratePerNight: (r.base_rate_per_night as number) ?? null,
    currency: (r.currency as string) ?? 'USD',
    isShared: (r.is_shared as boolean) ?? false,
  }));

  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, status, guest_type, num_guests, room_id, person_id, retreat_id, persons(full_name), retreats(name)')
    .not('room_id', 'is', null)
    .not('status', 'eq', 'cancelled');

  const bookings: CalendarBooking[] = (bookingsData ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    guestName: ((b.persons as Record<string, unknown>)?.full_name as string) ?? 'Unknown',
    retreatName: ((b.retreats as Record<string, unknown>)?.name as string) ?? null,
    roomId: b.room_id as string,
    checkIn: b.check_in as string,
    checkOut: b.check_out as string,
    status: b.status as string,
    guestType: (b.guest_type as string) ?? 'participant',
    numGuests: (b.num_guests as number) ?? 1,
  }));

  const { data: blocksData } = await supabase
    .from('retreat_room_blocks')
    .select('id, name, start_date, end_date, block_type, retreat_room_block_rooms(room_id)');

  const roomBlocks: CalendarRoomBlock[] = (blocksData ?? []).map((bl: Record<string, unknown>) => ({
    id: bl.id as string,
    name: bl.name as string,
    startDate: bl.start_date as string,
    endDate: bl.end_date as string,
    roomIds: ((bl.retreat_room_block_rooms as Array<Record<string, unknown>>) ?? []).map(
      (r) => r.room_id as string,
    ),
    blockType: (bl.block_type as string) ?? 'simple',
  }));

  const roomGroups = sortRooms(rooms);

  return (
    <CalendarGrid
      roomGroups={roomGroups}
      bookings={bookings}
      roomBlocks={roomBlocks}
      dict={dict}
    />
  );
}
