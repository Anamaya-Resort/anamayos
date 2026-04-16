import { createServiceClient } from '@/lib/supabase/server';
import { getSession, getSessionLocale } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/config/app';
import { RoomInfoEditor } from '@/modules/rooms/room-info-editor';

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

  return (
    <RoomInfoEditor
      room={room as Record<string, unknown>}
      categories={(categories ?? []) as Array<{ id: string; name: string }>}
      dict={dict}
    />
  );
}
