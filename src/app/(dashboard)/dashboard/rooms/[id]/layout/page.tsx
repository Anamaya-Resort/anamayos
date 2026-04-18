import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getOrgBranding } from '@/lib/branding';
import { RoomBuilderShell } from '@/modules/room-builder';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Room Layout Builder — AO Platform' };

export default async function RoomLayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roomId } = await params;
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  // Fetch room with beds
  const { data: room } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy, is_shared, room_group, beds(id, label, bed_type, capacity, width_m, length_m, is_active, sort_order)')
    .eq('id', roomId)
    .single();

  if (!room) {
    return <div className="p-8 text-center text-muted-foreground">Room not found.</div>;
  }

  const bedsRaw = (room.beds as Array<Record<string, unknown>>) ?? [];
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

  // Fetch existing layout
  const { data: layoutRow } = await supabase
    .from('room_layouts')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  const initialLayout = layoutRow
    ? {
        layout_json: layoutRow.layout_json as Record<string, unknown>,
        unit: (layoutRow.unit as string) ?? 'meters',
      }
    : {
        layout_json: { shapes: [], beds: [], labels: [] },
        unit: 'meters',
      };

  // Fetch org branding fonts for resort config defaults
  const { branding } = await getOrgBranding();
  const brandingFonts = {
    heading: branding.fontHeading ?? 'Inter',
    body: branding.fontBody ?? 'Inter',
  };

  return (
    <RoomBuilderShell
      roomId={roomId}
      roomName={room.name as string}
      beds={beds}
      initialLayout={initialLayout}
      brandingFonts={brandingFonts}
      dict={dict}
    />
  );
}
