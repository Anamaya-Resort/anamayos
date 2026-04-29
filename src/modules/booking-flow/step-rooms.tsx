'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { RoomCard } from '@/modules/rooms/room-card';
import type { RoomData } from '@/modules/rooms/types';
import {
  filterRoomsForGuest,
  type RoomAvailability,
  type FilteredRoom,
} from '@/lib/booking-availability';
import type { WizardState } from './booking-wizard';

interface StepRoomsProps {
  rooms: RoomData[];
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

type RenderRoom = {
  data: RoomData;
  availableBeds: number;
  needsApproval: boolean;
  matchQuality: 'perfect' | 'fallback' | 'unavailable';
};

export function StepRooms({ rooms, state, onUpdate, onNext, onBack }: StepRoomsProps) {
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<RoomAvailability[]>([]);

  useEffect(() => {
    if (!state.checkIn || !state.checkOut) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bookings/availability?checkIn=${state.checkIn}&checkOut=${state.checkOut}`);
        if (!res.ok) return;
        const { rooms: avail } = (await res.json()) as { rooms: RoomAvailability[] };
        setAvailability(avail);
      } finally {
        setLoading(false);
      }
    })();
  }, [state.checkIn, state.checkOut]);

  const renderRooms: RenderRoom[] = useMemo(() => {
    if (availability.length === 0) return [];
    const filteredByGuest = filterRoomsForGuest(availability, state.guestType);
    const matchById = new Map<string, FilteredRoom>(filteredByGuest.map((r) => [r.roomId, r]));
    const availabilityById = new Map<string, RoomAvailability>(availability.map((r) => [r.roomId, r]));

    return rooms.map((room) => {
      const avail = availabilityById.get(room.id);
      const match = matchById.get(room.id);
      if (!avail || avail.isFullyBooked) {
        return { data: room, availableBeds: 0, needsApproval: false, matchQuality: 'unavailable' as const };
      }
      if (match) {
        return {
          data: room,
          availableBeds: avail.availableBeds.length,
          needsApproval: match.needsApproval,
          matchQuality: match.matchQuality,
        };
      }
      // Has beds but the room doesn't fit the guest type — show as unavailable for this party
      return { data: room, availableBeds: avail.availableBeds.length, needsApproval: false, matchQuality: 'unavailable' as const };
    });
  }, [rooms, availability, state.guestType]);

  const perfect = renderRooms.filter((r) => r.matchQuality === 'perfect');
  const fallback = renderRooms.filter((r) => r.matchQuality === 'fallback');
  const unavailable = renderRooms.filter((r) => r.matchQuality === 'unavailable');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderGroup = (group: RenderRoom[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {group.map((r) => (
        <RoomCard
          key={r.data.id}
          room={r.data}
          mode="select"
          availableBeds={r.availableBeds}
          isSelected={state.roomId === r.data.id}
          onSelect={() => onUpdate({ roomId: r.data.id, roomName: r.data.name, needsApproval: r.needsApproval })}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose Your Room</h2>
        <p className="text-sm text-muted-foreground">
          Showing rooms available for {state.checkIn} — {state.checkOut}
          {state.guestType === 'couple_shared' && ' with shared bed options'}
          {state.guestType === 'couple_separate' && ' with separate beds'}
        </p>
      </div>

      {renderRooms.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">No rooms configured.</p>
      )}

      {perfect.length > 0 && (
        <div>
          {(fallback.length > 0 || unavailable.length > 0) && (
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Best Matches</h3>
          )}
          {renderGroup(perfect)}
        </div>
      )}

      {fallback.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Other Options (needs approval)
          </h3>
          {renderGroup(fallback)}
        </div>
      )}

      {unavailable.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Unavailable for these dates</h3>
          {renderGroup(unavailable)}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!state.roomId}>Next: Choose Bed</Button>
      </div>
    </div>
  );
}
