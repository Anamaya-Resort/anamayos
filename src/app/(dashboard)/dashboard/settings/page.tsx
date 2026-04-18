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

  // Fetch rooms with bed counts, layout status, and thumbnails
  const { data: roomsData } = await supabase
    .from('rooms')
    .select('id, name, category, beds(id, label, bed_type), room_layouts(id, layout_json)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const rooms = (roomsData ?? []).map((r: Record<string, unknown>) => {
    const beds = (r.beds as Array<{ id: string; label: string; bed_type: string }>) ?? [];
    const layouts = (r.room_layouts as Array<{ id: string; layout_json: Record<string, unknown> }>) ?? [];
    const layout = layouts[0];
    const thumbnail = layout?.layout_json?.thumbnail as string | undefined;
    const shapeCount = ((layout?.layout_json?.shapes as unknown[]) ?? []).length;
    const furnitureCount = ((layout?.layout_json?.furniture as unknown[]) ?? []).length;
    const openingCount = ((layout?.layout_json?.openings as unknown[]) ?? []).length;
    return {
      id: r.id as string,
      name: r.name as string,
      category: (r.category as string) ?? '',
      bedCount: beds.length,
      bedLabels: beds.map((b) => b.label),
      hasLayout: layouts.length > 0,
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
