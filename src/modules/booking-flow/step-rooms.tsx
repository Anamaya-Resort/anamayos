'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { filterRoomsForGuest, type RoomAvailability, type FilteredRoom } from '@/lib/booking-availability';
import type { WizardState } from './booking-wizard';

interface StepRoomsProps {
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepRooms({ state, onUpdate, onNext, onBack }: StepRoomsProps) {
  const [loading, setLoading] = useState(true);
  const [filtered, setFiltered] = useState<FilteredRoom[]>([]);

  useEffect(() => {
    if (!state.checkIn || !state.checkOut) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bookings/availability?checkIn=${state.checkIn}&checkOut=${state.checkOut}`);
        if (!res.ok) return;
        const { rooms: avail } = await res.json() as { rooms: RoomAvailability[] };
        const result = filterRoomsForGuest(avail, state.guestType);
        setFiltered(result);
      } finally {
        setLoading(false);
      }
    })();
  }, [state.checkIn, state.checkOut, state.guestType]);

  const selectRoom = (roomId: string, roomName: string, needsApproval: boolean) => {
    onUpdate({ roomId, roomName, needsApproval });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const perfect = filtered.filter((r) => r.matchQuality === 'perfect');
  const fallback = filtered.filter((r) => r.matchQuality === 'fallback');

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

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">No rooms available for these dates and preferences.</p>
      )}

      {perfect.length > 0 && (
        <div>
          {fallback.length > 0 && <h3 className="text-sm font-medium text-muted-foreground mb-3">Best Matches</h3>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {perfect.map((room) => (
              <div key={room.roomId}
                className={`cursor-pointer rounded-lg transition-all ${state.roomId === room.roomId ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                onClick={() => selectRoom(room.roomId, room.roomName, room.needsApproval)}>
                <div className="border rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold">{room.roomName}</h4>
                  <p className="text-xs text-muted-foreground">
                    {room.availableBeds.length} of {room.totalBeds} beds available
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {room.availableBeds.map((b) => (
                      <span key={b.bedId} className="text-[10px] bg-muted rounded px-1.5 py-0.5">{b.label} ({b.bedType})</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fallback.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Other Options (needs approval)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fallback.map((room) => (
              <div key={room.roomId}
                className={`cursor-pointer rounded-lg transition-all ${state.roomId === room.roomId ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                onClick={() => selectRoom(room.roomId, room.roomName, true)}>
                <div className="border rounded-lg p-4 space-y-2 border-dashed border-warning">
                  <h4 className="font-semibold">{room.roomName}</h4>
                  <p className="text-[10px] text-status-warning">Requires staff approval — double rate in triple room</p>
                  <p className="text-xs text-muted-foreground">
                    {room.availableBeds.length} of {room.totalBeds} beds available
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!state.roomId}>Next: Choose Bed</Button>
      </div>
    </div>
  );
}
