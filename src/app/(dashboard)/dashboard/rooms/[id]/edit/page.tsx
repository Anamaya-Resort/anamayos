import { createServiceClient } from '@/lib/supabase/server';
import { getSession, getSessionLocale } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/config/app';
import { RoomInfoEditor } from '@/modules/rooms/room-info-editor';
import { ROOM_DATA } from '@/modules/rooms/room-data';

export default async function RoomEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) redirect('/dashboard/rooms');

  const { id: roomId } = await params;
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const { data: room } = await supabase
    .from('rooms')
    .select('id, name, slug, description, max_occupancy, is_shared, base_rate_per_night, currency, room_group, amenities, category_id, sort_order, room_categories(name)')
    .eq('id', roomId)
    .single();

  if (!room) notFound();

  const { data: categories } = await supabase
    .from('room_categories')
    .select('id, name')
    .order('sort_order');

  // Fetch beds for this room (same data as Room Builder)
  const { data: bedsData } = await supabase
    .from('beds')
    .select('id, label, bed_type, capacity')
    .eq('room_id', roomId)
    .eq('is_active', true)
    .order('sort_order');

  // Resolve supplement data (same logic as fetch-rooms.ts)
  const name = (room.name as string) ?? '';
  const firstWord = name.toLowerCase().split(' ')[0];
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const supplement = ROOM_DATA[firstWord] ?? ROOM_DATA[slug] ?? ROOM_DATA[name.toLowerCase()] ?? undefined;

  const amenities = (room.amenities as Record<string, unknown>) ?? {};
  const dbGallery = (amenities.gallery_images as string[]) ?? [];
  const dbFeatures = (amenities.features as string[]) ?? [];
  const dbLongDesc = (amenities.long_description as string) ?? '';

  // Merge: DB takes priority, supplement is fallback
  const resolvedData = {
    images: dbGallery.length > 0 ? dbGallery : (supplement?.images ?? []),
    features: dbFeatures.length > 0 ? dbFeatures : (supplement?.features ? supplement.features.split(' -- ').map((f: string) => f.trim()) : []),
    shortDescription: (room.description as string) || supplement?.shortDescription || '',
    longDescription: dbLongDesc || supplement?.longDescription || '',
  };

  return (
    <RoomInfoEditor
      room={room as Record<string, unknown>}
      categories={(categories ?? []) as Array<{ id: string; name: string }>}
      beds={(bedsData ?? []) as Array<{ id: string; label: string; bed_type: string; capacity: number }>}
      resolvedData={resolvedData}
      dict={dict}
    />
  );
}
