import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Rooms — AO Platform' };

export default async function RoomsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*, room_categories(name), beds(id, label, bed_type, is_active)')
    .order('sort_order');

  const items = (rooms ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.rooms.title}
        description={`${items.length} ${dict.rooms.title.toLowerCase()}`}
      />

      {items.length === 0 ? (
        <EmptyState title={dict.rooms.noRooms} description={dict.rooms.noRoomsDesc} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((room) => {
            const cat = room.room_categories as Record<string, unknown> | null;
            const beds = (room.beds as Array<Record<string, unknown>>) ?? [];
            const activeBeds = beds.filter((b) => b.is_active);

            return (
              <Card key={room.id as string}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{room.name as string}</h3>
                      {cat && <p className="text-xs text-muted-foreground">{cat.name as string}</p>}
                    </div>
                    <Badge variant="outline" className={room.is_active ? 'text-status-success' : 'text-status-destructive'}>
                      {room.is_active ? dict.products.active : dict.products.inactive}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{dict.rooms.maxOccupancy}</span>
                      <p className="font-medium">{room.max_occupancy as number}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{dict.rooms.rate}</span>
                      <p className="font-medium font-mono">
                        {room.base_rate_per_night != null ? `$${Number(room.base_rate_per_night).toFixed(0)}` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{dict.rooms.shared}/{dict.rooms.private}</span>
                      <p className="font-medium">{room.is_shared ? dict.rooms.shared : dict.rooms.private}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{dict.rooms.beds}</span>
                      <p className="font-medium">{activeBeds.length}</p>
                    </div>
                  </div>

                  {activeBeds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeBeds.map((bed) => (
                        <Badge key={bed.id as string} variant="outline" className="text-xs">
                          {bed.label as string} ({bed.bed_type as string})
                        </Badge>
                      ))}
                    </div>
                  )}

                  {Boolean(room.building) && (
                    <p className="text-xs text-muted-foreground">{dict.rooms.building}: {room.building as string}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
