import { createServiceClient } from '@/lib/supabase/server';
import { ROOM_DATA } from './room-data';
import type { RoomData } from './types';

/**
 * Fetch all rooms with beds, categories, and images.
 * Used by both the Rooms admin page and the booking form room selector.
 */
export async function fetchRoomData(): Promise<RoomData[]> {
  const supabase = createServiceClient();

  const { data: roomsData } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy, is_shared, base_rate_per_night, currency, room_group, description, amenities, room_categories(name), beds(id, label, bed_type, is_active, sort_order)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (roomsData ?? []).map((r: Record<string, unknown>) => {
    const cat = r.room_categories as { name: string } | null;
    const bedsRaw = (r.beds as Array<Record<string, unknown>>) ?? [];
    const beds = bedsRaw
      .filter((b) => b.is_active !== false)
      .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
      .map((b) => ({
        id: b.id as string,
        label: b.label as string,
        bedType: b.bed_type as string,
      }));

    const amenities = r.amenities as Record<string, unknown> | null;
    const heroImage = (amenities?.hero_image as string) ?? null;

    // Get supplemental data (images, description, features) from ROOM_DATA
    // This will eventually move fully to the database
    const roomKey = (r.name as string).toLowerCase().split(' ')[0];
    const supplement = ROOM_DATA[roomKey];

    return {
      id: r.id as string,
      name: r.name as string,
      maxOccupancy: (r.max_occupancy as number) ?? 2,
      isShared: (r.is_shared as boolean) ?? false,
      ratePerNight: (r.base_rate_per_night as number) ?? null,
      currency: (r.currency as string) ?? 'USD',
      roomGroup: (r.room_group as string) ?? 'other',
      category: cat?.name ?? '',
      description: (r.description as string) || supplement?.description || null,
      heroImage: heroImage ?? supplement?.images[0] ?? null,
      galleryImages: supplement?.images ?? [],
      features: supplement?.features ? supplement.features.split(' -- ').map((f: string) => f.trim()) : [],
      beds,
    };
  });
}
