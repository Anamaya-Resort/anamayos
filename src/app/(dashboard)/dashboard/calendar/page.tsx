import { CalendarGrid } from '@/modules/calendar';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { CalendarRoom, CalendarBooking, CalendarRoomBlock } from '@/modules/calendar';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Calendar — AO Platform' };

export default async function CalendarPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  // Rooms — grouped and sorted by DB fields
  const { data: roomsData } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy, is_shared, base_rate_per_night, currency, room_group, room_categories(name), beds(id, label, bed_type, is_active, sort_order)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const allRooms = (roomsData ?? []).map((r: Record<string, unknown>) => {
    const bedsRaw = (r.beds as Array<Record<string, unknown>>) ?? [];
    const activeBeds = bedsRaw
      .filter((b) => b.is_active !== false)
      .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      .map((b) => ({
        id: b.id as string,
        label: b.label as string,
        bedType: b.bed_type as string,
      }));

    return {
      id: r.id as string,
      name: r.name as string,
      maxOccupancy: (r.max_occupancy as number) ?? 2,
      category: ((r.room_categories as Record<string, unknown>)?.name as string) ?? '',
      ratePerNight: (r.base_rate_per_night as number) ?? null,
      currency: (r.currency as string) ?? 'USD',
      isShared: (r.is_shared as boolean) ?? false,
      beds: activeBeds,
      room_group: (r.room_group as string) ?? null,
    };
  });

  // Group rooms by room_group from DB, preserving sort_order
  const groupMap = new Map<string, CalendarRoom[]>();
  for (const room of allRooms) {
    const group = room.room_group ?? 'other';
    if (!groupMap.has(group)) groupMap.set(group, []);
    groupMap.get(group)!.push(room);
  }

  // Order groups: upper first, lower second, then any others
  const groupOrder = ['upper', 'lower'];
  const roomGroups: { group: string; rooms: CalendarRoom[] }[] = [];
  for (const g of groupOrder) {
    if (groupMap.has(g)) {
      roomGroups.push({ group: g, rooms: groupMap.get(g)! });
      groupMap.delete(g);
    }
  }
  for (const [g, rooms] of groupMap) {
    roomGroups.push({ group: g, rooms });
  }

  // Bookings
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, status, guest_type, num_guests, room_id, persons(full_name), retreats(name)')
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

  // Room blocks
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

  return (
    <CalendarGrid
      roomGroups={roomGroups}
      bookings={bookings}
      roomBlocks={roomBlocks}
      dict={dict}
    />
  );
}
