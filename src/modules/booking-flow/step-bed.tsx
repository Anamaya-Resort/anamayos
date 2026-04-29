'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { Stage, Layer, Rect } from 'react-konva';
import { RoomBaseRenderer } from '@/modules/room-builder/room-base-renderer';
import { RoomLayoutContainer } from '@/modules/room-builder/room-layout-container';
import { BookingOverlay, type BedOccupancy } from '@/modules/room-builder/overlays/booking-overlay';
import { CANVAS_BG } from '@/modules/room-builder/colors';
import type { LayoutJson, LayoutUnit } from '@/modules/room-builder/types';
import type { RoomAvailability } from '@/lib/booking-availability';
import type { WizardState } from './booking-wizard';

interface StepBedProps {
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBed({ state, onUpdate, onNext, onBack }: StepBedProps) {
  const [layout, setLayout] = useState<{ json: LayoutJson; unit: LayoutUnit; beds: Array<{ id: string; label: string; bedType: string; capacity: number }> } | null>(null);
  const [availability, setAvailability] = useState<RoomAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    bedLabel: string;
    previousBedIds: string[];
    previousBedArrangement: string | undefined;
    previousBookingType: string | undefined;
  } | null>(null);

  useEffect(() => {
    if (!state.roomId) return;
    (async () => {
      setLoading(true);
      try {
        // Fetch availability
        const availRes = await fetch(`/api/bookings/availability?checkIn=${state.checkIn}&checkOut=${state.checkOut}`);
        let roomAvail: RoomAvailability | null = null;
        if (availRes.ok) {
          const { rooms } = await availRes.json() as { rooms: RoomAvailability[] };
          roomAvail = rooms.find((r) => r.roomId === state.roomId) ?? null;
          setAvailability(roomAvail);
        }

        // Fetch layout
        const layoutRes = await fetch(`/api/admin/rooms/${state.roomId}/layout`);
        if (layoutRes.ok) {
          const data = await layoutRes.json();
          const lj = data.layout?.layout_json as LayoutJson;
          if (lj) {
            const allAvail = roomAvail?.availableBeds ?? [];
            const allOcc = roomAvail?.occupiedBeds ?? [];
            setLayout({
              json: lj,
              unit: (data.layout?.unit as LayoutUnit) ?? 'meters',
              beds: [
                ...allAvail.map((b) => ({ id: b.bedId, label: b.label, bedType: b.bedType, capacity: b.capacity })),
                ...allOcc.map((b) => ({ id: b.bedId, label: b.guestName ?? '', bedType: 'single', capacity: 1 })),
              ],
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [state.roomId, state.checkIn, state.checkOut]);

  // Rebuild beds list from availability when it loads
  const roomAvail = availability;
  const allBeds = roomAvail ? [
    ...roomAvail.availableBeds.map((b) => ({ id: b.bedId, label: b.label, bedType: b.bedType, capacity: b.capacity })),
    ...roomAvail.occupiedBeds.map((b) => ({ id: b.bedId, label: '', bedType: 'single', capacity: 1 })),
  ] : layout?.beds ?? [];

  const occupancy: BedOccupancy[] = (roomAvail?.occupiedBeds ?? []).map((b) => ({
    bedId: b.bedId,
    guestName: b.guestName,
  }));

  const toggleBed = (bedId: string) => {
    const isAvailable = roomAvail?.availableBeds.some((b) => b.bedId === bedId);
    if (!isAvailable) return;

    const maxBeds = state.numGuests >= 2 ? 2 : 1;
    let newBedIds: string[];
    const isDeselect = state.bedIds.includes(bedId);

    if (isDeselect) {
      newBedIds = state.bedIds.filter((id) => id !== bedId);
    } else {
      // For couples with shared bed, clicking a split king auto-selects partner
      if (state.guestType === 'couple_shared') {
        const bed = roomAvail?.availableBeds.find((b) => b.bedId === bedId);
        if (bed?.splitKingPairBedId) {
          newBedIds = [bedId, bed.splitKingPairBedId];
        } else {
          newBedIds = [bedId]; // Queen or single bed
        }
      } else if (state.bedIds.length >= maxBeds) {
        newBedIds = [...state.bedIds.slice(1), bedId];
      } else {
        newBedIds = [...state.bedIds, bedId];
      }
    }

    // Determine bed arrangement
    let bedArrangement = 'single';
    let bookingType = 'Single Deluxe';
    if (newBedIds.length === 1) {
      const bed = roomAvail?.availableBeds.find((b) => b.bedId === newBedIds[0]);
      if (bed?.bedType === 'queen') { bedArrangement = 'queen'; bookingType = 'Double'; }
      else if (roomAvail && !roomAvail.isShared) { bedArrangement = 'single'; bookingType = 'Single Deluxe'; }
      else { bedArrangement = 'single'; bookingType = 'Retreat Shared'; }
    } else if (newBedIds.length === 2) {
      const bed = roomAvail?.availableBeds.find((b) => b.bedId === newBedIds[0]);
      if (bed?.splitKingPairBedId === newBedIds[1]) { bedArrangement = 'split_king'; bookingType = 'Double'; }
      else { bedArrangement = 'separate'; bookingType = 'Double'; }
      if (state.needsApproval) bookingType = 'Double in Triple';
    }

    onUpdate({ bedIds: newBedIds, bedArrangement, bookingType });

    // Show confirmation modal only when a new bed is being selected (not on deselect)
    if (!isDeselect) {
      const clickedBed = roomAvail?.availableBeds.find((b) => b.bedId === bedId);
      setConfirmModal({
        bedLabel: clickedBed?.label ?? 'Bed',
        previousBedIds: state.bedIds,
        previousBedArrangement: state.bedArrangement,
        previousBookingType: state.bookingType,
      });
    }
  };

  const handleCancelBedSelection = () => {
    if (!confirmModal) return;
    onUpdate({
      bedIds: confirmModal.previousBedIds,
      bedArrangement: confirmModal.previousBedArrangement,
      bookingType: confirmModal.previousBookingType,
    });
    setConfirmModal(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Pick Your Bed — {state.roomName}</h2>
        <p className="text-sm text-muted-foreground">
          Click on an available bed to select it.
          {state.numGuests >= 2 && ' Select beds for both guests.'}
        </p>
      </div>

      {/* Room layout */}
      {layout?.json && (
        <div style={{ border: '1px solid #e7e5e4', borderRadius: 8, overflow: 'hidden' }}>
          <RoomLayoutContainer layoutJson={layout.json} beds={allBeds} maxHeight={400}>
            {({ width, height, scale, offsetX, offsetY }) => (
              <Stage width={width || 1} height={height || 1}>
                <Layer listening={false}>
                  <Rect x={0} y={0} width={width} height={height} fill={CANVAS_BG} />
                </Layer>
                <RoomBaseRenderer
                  layoutJson={layout.json}
                  beds={allBeds}
                  scale={scale}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  resortConfig={layout.json.resortConfig}
                >
                  <BookingOverlay
                    layoutJson={layout.json}
                    beds={allBeds}
                    occupancy={occupancy}
                    scale={scale}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    selectedBedId={state.bedIds[0] ?? null}
                    onBedClick={toggleBed}
                  />
                </RoomBaseRenderer>
              </Stage>
            )}
          </RoomLayoutContainer>
        </div>
      )}

      {/* Selected beds summary */}
      {state.bedIds.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium">Selected: {state.bedIds.length} bed{state.bedIds.length > 1 ? 's' : ''}</p>
          {state.bedArrangement && (
            <p className="text-xs text-muted-foreground">
              Arrangement: {state.bedArrangement.replace('_', ' ')} — {state.bookingType}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={state.bedIds.length === 0}>
          Next: Your Details
        </Button>
      </div>

      <Dialog
        open={!!confirmModal}
        onOpenChange={(open) => { if (!open) setConfirmModal(null); }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Bed {confirmModal?.bedLabel} selected</DialogTitle>
            <DialogDescription>
              Continue with this bed, or cancel to choose a different one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelBedSelection}>
              Cancel Bed Selection
            </Button>
            <Button onClick={() => setConfirmModal(null)}>
              Back to Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
