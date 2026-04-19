import { createServiceClient } from '@/lib/supabase/server';
import type { RoomAvailability, AvailableBed } from '@/lib/booking-availability';

/**
 * GET /api/bookings/availability?checkIn=2026-01-01&checkOut=2026-01-08&retreatId=xxx
 * Returns per-room availability with bed-level detail.
 */
export async function GET(request: Request) {
  // Public endpoint — no auth required for guests booking
  const url = new URL(request.url);
  const checkIn = url.searchParams.get('checkIn');
  const checkOut = url.searchParams.get('checkOut');

  if (!checkIn || !checkOut) {
    return Response.json({ error: 'checkIn and checkOut required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Fetch all active rooms with beds
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy, is_shared, beds(id, label, bed_type, capacity)')
    .eq('is_active', true)
    .order('sort_order');

  if (!rooms) return Response.json({ rooms: [] });

  // 2. Find all bookings overlapping the date range (non-cancelled)
  const { data: overlappingBookings } = await supabase
    .from('bookings')
    .select('id, room_id')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
    .not('status', 'in', '("cancelled","no_show")');

  const bookingIds = (overlappingBookings ?? []).map((b: { id: string }) => b.id);

  // 3. Find occupied beds from bed assignments
  let occupiedBedMap = new Map<string, string>(); // bedId → guestName
  if (bookingIds.length > 0) {
    const { data: assignments } = await supabase
      .from('booking_bed_assignments')
      .select('bed_id, booking_id, bookings(person_id)')
      .in('booking_id', bookingIds)
      .in('status', ['confirmed', 'pending_approval']);

    // Get guest names for occupied beds
    const personIds = new Set<string>();
    const bedToBooking = new Map<string, string>();
    for (const a of (assignments ?? []) as unknown as Array<{ bed_id: string; booking_id: string; bookings: { person_id: string } | null }>) {
      bedToBooking.set(a.bed_id, a.booking_id);
      if (a.bookings?.person_id) personIds.add(a.bookings.person_id);
    }

    if (personIds.size > 0) {
      const { data: persons } = await supabase
        .from('persons')
        .select('id, full_name')
        .in('id', Array.from(personIds));
      const nameMap = new Map((persons ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

      for (const a of (assignments ?? []) as unknown as Array<{ bed_id: string; bookings: { person_id: string } | null }>) {
        const name = a.bookings?.person_id ? nameMap.get(a.bookings.person_id) : undefined;
        occupiedBedMap.set(a.bed_id, name ?? 'Occupied');
      }
    }
  }

  // 4. Check room_availability for date blocks
  const { data: dateBlocks } = await supabase
    .from('room_availability')
    .select('room_id')
    .eq('is_available', false)
    .gte('date', checkIn)
    .lt('date', checkOut);

  const blockedRoomIds = new Set((dateBlocks ?? []).map((b: { room_id: string }) => b.room_id));

  // 5. Fetch layout data to get split king pair info
  const { data: layouts } = await supabase
    .from('room_layouts')
    .select('room_id, layout_json');

  const layoutMap = new Map<string, Record<string, unknown>>();
  for (const l of (layouts ?? []) as Array<{ room_id: string; layout_json: Record<string, unknown> }>) {
    layoutMap.set(l.room_id, l.layout_json);
  }

  // 6. Build availability per room
  const result: RoomAvailability[] = [];

  for (const room of rooms as Array<{ id: string; name: string; max_occupancy: number; is_shared: boolean; beds: Array<{ id: string; label: string; bed_type: string; capacity: number }> }>) {
    if (blockedRoomIds.has(room.id)) continue;

    const beds = room.beds ?? [];
    const layout = layoutMap.get(room.id);
    // LayoutBedPlacement has: { id (placement ID), bedId (FK to beds), splitKingPairId (partner placement ID) }
    const layoutBeds = (layout?.beds as Array<{ id: string; bedId: string; splitKingPairId: string | null }>) ?? [];

    // Build split king pair lookup: bedId → partner's bedId
    const splitKingMap = new Map<string, string>();
    const placementById = new Map(layoutBeds.map((lb) => [lb.id, lb]));
    for (const lb of layoutBeds) {
      if (lb.splitKingPairId) {
        const partner = placementById.get(lb.splitKingPairId);
        if (partner) {
          splitKingMap.set(lb.bedId, partner.bedId);
        }
      }
    }

    const availableBeds: AvailableBed[] = [];
    const occupiedBeds: { bedId: string; guestName?: string }[] = [];

    for (const bed of beds) {
      if (occupiedBedMap.has(bed.id)) {
        occupiedBeds.push({ bedId: bed.id, guestName: occupiedBedMap.get(bed.id) });
      } else {
        availableBeds.push({
          bedId: bed.id,
          label: bed.label,
          bedType: bed.bed_type,
          capacity: bed.capacity,
          splitKingPairBedId: splitKingMap.get(bed.id) ?? null,
        });
      }
    }

    result.push({
      roomId: room.id,
      roomName: room.name,
      isShared: room.is_shared,
      maxOccupancy: room.max_occupancy,
      totalBeds: beds.length,
      availableBeds,
      occupiedBeds,
      isFullyBooked: availableBeds.length === 0,
    });
  }

  return Response.json({ rooms: result });
}
