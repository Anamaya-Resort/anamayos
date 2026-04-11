import { RoomGrid, fetchRoomData } from '@/modules/rooms';
import { PageHeader } from '@/components/shared';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Rooms — AO Platform' };

export default async function RoomsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const rooms = await fetchRoomData();

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.rooms.title}
        description={`${rooms.length} ${dict.rooms.title.toLowerCase()}`}
      />
      <RoomGrid rooms={rooms} mode="display" />
    </div>
  );
}
