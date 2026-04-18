import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import { ImportPanel } from '@/modules/admin/import-panel';
import { ButtonEffectsShowcase } from '@/modules/admin/button-effects-showcase';
import { RoomLayoutsPanel } from '@/modules/admin/room-layouts-panel';
import { OrgSettingsPanel } from '@/modules/admin/org-settings-panel';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Settings — AO Platform' };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  // Fetch rooms with bed info
  const { data: roomsData } = await supabase
    .from('rooms')
    .select('id, name, beds(id, label, bed_type)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Fetch layouts separately (layout_json can be large due to thumbnails)
  const { data: layoutsData } = await supabase
    .from('room_layouts')
    .select('room_id, layout_json');

  const layoutByRoom = new Map<string, Record<string, unknown>>();
  for (const l of (layoutsData ?? []) as Array<{ room_id: string; layout_json: Record<string, unknown> }>) {
    layoutByRoom.set(l.room_id, l.layout_json);
  }

  const rooms = (roomsData ?? []).map((r: Record<string, unknown>) => {
    const beds = (r.beds as Array<{ id: string; label: string; bed_type: string }>) ?? [];
    const lj = layoutByRoom.get(r.id as string);
    const thumbnail = lj?.thumbnail as string | undefined;
    const shapeCount = ((lj?.shapes as unknown[]) ?? []).length;
    const furnitureCount = ((lj?.furniture as unknown[]) ?? []).length;
    const openingCount = ((lj?.openings as unknown[]) ?? []).length;
    return {
      id: r.id as string,
      name: r.name as string,
      category: '',
      bedCount: beds.length,
      bedLabels: beds.map((b) => b.label),
      hasLayout: !!lj,
      thumbnail: thumbnail ?? null,
      shapeCount,
      furnitureCount,
      openingCount,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={dict.settings.title} />

      <Tabs defaultValue={params.tab ?? 'general'}>
        <TabsList>
          <TabsTrigger value="general">{dict.settings.general}</TabsTrigger>
          <TabsTrigger value="organization">{dict.settings.organization}</TabsTrigger>
          <TabsTrigger value="roomLayouts">{dict.settings.roomLayouts}</TabsTrigger>
          <TabsTrigger value="import">{dict.settings.import}</TabsTrigger>
          <TabsTrigger value="effects">{dict.settings.buttonEffects}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.settings.general}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{dict.settings.comingSoon}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="mt-4">
          <OrgSettingsPanel />
        </TabsContent>

        <TabsContent value="roomLayouts" className="mt-4">
          <RoomLayoutsPanel rooms={rooms} dict={dict} />
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <ImportPanel dict={dict} />
        </TabsContent>

        <TabsContent value="effects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{dict.settings.buttonEffects}</CardTitle>
            </CardHeader>
            <CardContent>
              <ButtonEffectsShowcase />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
