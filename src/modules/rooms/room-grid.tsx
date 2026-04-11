'use client';

import { RoomCard } from './room-card';
import type { RoomData, RoomCardMode } from './types';

interface RoomGridProps {
  rooms: RoomData[];
  mode: RoomCardMode;
  selectedRoomId?: string;
  /** Map of roomId → available bed count (for select mode) */
  availability?: Map<string, number>;
  onSelect?: (roomId: string) => void;
}

export function RoomGrid({ rooms, mode, selectedRoomId, availability, onSelect }: RoomGridProps) {
  const upper = rooms.filter((r) => r.roomGroup === 'upper');
  const lower = rooms.filter((r) => r.roomGroup === 'lower');
  const other = rooms.filter((r) => r.roomGroup !== 'upper' && r.roomGroup !== 'lower');

  function renderGroup(label: string, groupRooms: RoomData[]) {
    if (groupRooms.length === 0) return null;
    return (
      <>
        <div className="bf-subsection-label" style={{ margin: '12px 0 8px' }}>{label}</div>
        <div className="bf-room-grid">
          {groupRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              mode={mode}
              isSelected={selectedRoomId === room.id}
              availableBeds={availability?.get(room.id)}
              onSelect={() => onSelect?.(room.id)}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div>
      {renderGroup('Upper Rooms', upper)}
      {renderGroup('Lower Rooms', lower)}
      {other.length > 0 && renderGroup('Other', other)}
    </div>
  );
}
