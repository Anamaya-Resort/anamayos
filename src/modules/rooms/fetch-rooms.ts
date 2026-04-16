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
    .select('id, name, max_occupancy, is_shared, base_rate_per_night, currency, room_group, description, amenities, room_categories(name), beds(id, label, bed_type, capacity, width_m, length_m, is_active, sort_order)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Fetch layout thumbnails for all rooms
  const roomIds = (roomsData ?? []).map((r: Record<string, unknown>) => r.id as string);
  const { data: layoutsData } = await supabase
    .from('room_layouts')
    .select('room_id, layout_json')
    .in('room_id', roomIds);
  const thumbnailMap = new Map<string, string>();
  for (const layout of (layoutsData ?? []) as Array<{ room_id: string; layout_json: Record<string, unknown> }>) {
    const thumb = layout.layout_json?.thumbnail as string | undefined;
    if (thumb) thumbnailMap.set(layout.room_id, thumb);
  }

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
        capacity: (b.capacity as number) ?? 1,
        widthM: (b.width_m as number) ?? null,
        lengthM: (b.length_m as number) ?? null,
      }));

    const amenities = r.amenities as Record<string, unknown> | null;
    const heroImage = (amenities?.hero_image as string) ?? null;

    // Get supplemental data (images, description, features) from ROOM_DATA
    // Try multiple key strategies: first word, full name slugified, exact lowercase
    const name = (r.name as string) ?? '';
    const firstWord = name.toLowerCase().split(' ')[0];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const supplement = ROOM_DATA[firstWord] ?? ROOM_DATA[slug] ?? ROOM_DATA[name.toLowerCase()] ?? undefined;

    // DB-stored data (from editor) takes priority over ROOM_DATA supplement
    const dbGallery = (amenities?.gallery_images as string[]) ?? [];
    const dbFeatures = (amenities?.features as string[]) ?? [];
    const dbLongDesc = (amenities?.long_description as string) ?? '';

    return {
      id: r.id as string,
      name: r.name as string,
      maxOccupancy: (r.max_occupancy as number) ?? 2,
      isShared: (r.is_shared as boolean) ?? false,
      ratePerNight: (r.base_rate_per_night as number) ?? null,
      currency: (r.currency as string) ?? 'USD',
      roomGroup: (r.room_group as string) ?? 'other',
      category: cat?.name ?? '',
      description: (r.description as string) || supplement?.shortDescription || null,
      longDescription: dbLongDesc || supplement?.longDescription || null,
      heroImage: heroImage ?? dbGallery[0] ?? supplement?.images[0] ?? null,
      galleryImages: dbGallery.length > 0 ? dbGallery : (supplement?.images ?? []),
      features: dbFeatures.length > 0 ? dbFeatures : (supplement?.features ? supplement.features.split(' -- ').map((f: string) => f.trim()) : []),
      beds,
      layoutThumbnail: thumbnailMap.get(r.id as string) ?? null,
    };
  });
}
