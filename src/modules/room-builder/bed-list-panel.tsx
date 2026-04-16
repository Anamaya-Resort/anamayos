'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { BED_PRESETS } from './types';
import type { LayoutBedPlacement } from './types';
import type { RoomBed } from './room-builder-shell';
import type { TranslationKeys } from '@/i18n/en';

interface BedListPanelProps {
  roomId: string;
  beds: RoomBed[];
  setBeds: React.Dispatch<React.SetStateAction<RoomBed[]>>;
  placedBedIds: Set<string>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  bedPlacements: LayoutBedPlacement[];
  dict: TranslationKeys;
}

export function BedListPanel({
  roomId,
  beds,
  setBeds,
  placedBedIds,
  selectedId,
  setSelectedId,
  bedPlacements,
  dict,
}: BedListPanelProps) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('single');
  const dragRef = useRef<{ bedId: string; bedType: string } | null>(null);

  // Add a new bed to the DB
  const handleAddBed = async () => {
    if (!newLabel.trim()) return;
    const preset = BED_PRESETS.find((p) => p.type === newType);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          bed_type: newType,
          capacity: preset?.capacity ?? 1,
          width_m: preset?.width ?? 1.0,
          length_m: preset?.length ?? 1.9,
        }),
      });
      if (res.ok) {
        const { bed } = await res.json();
        setBeds((prev) => [
          ...prev,
          {
            id: bed.id,
            label: bed.label,
            bedType: bed.bed_type,
            capacity: bed.capacity,
            widthM: bed.width_m,
            lengthM: bed.length_m,
          },
        ]);
        setNewLabel('');
        setAdding(false);
      }
    } catch {
      // Silently fail — user can retry
    }
  };

  // Remove a bed from the DB
  const handleRemoveBed = async (bedId: string) => {
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/beds?bedId=${bedId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBeds((prev) => prev.filter((b) => b.id !== bedId));
      }
    } catch {
      // Silently fail
    }
  };

  // Drag start — store bed info for drop onto canvas
  const handleDragStart = (e: React.DragEvent, bed: RoomBed) => {
    dragRef.current = { bedId: bed.id, bedType: bed.bedType };
    e.dataTransfer.setData('text/plain', bed.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // We dispatch a custom event when dropped on the canvas area
  const handleDragEnd = (e: React.DragEvent) => {
    if (dragRef.current) {
      window.dispatchEvent(
        new CustomEvent('room-builder-drop-bed', {
          detail: {
            ...dragRef.current,
            x: e.clientX,
            y: e.clientY,
          },
        }),
      );
      dragRef.current = null;
    }
  };

  const rb = dict.roomBuilder;

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{rb.beds}</h3>
        <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Add bed form */}
      {adding && (
        <div className="mb-3 rounded-md border p-2 space-y-2">
          <input
            type="text"
            placeholder="Bed label (e.g., Main 1)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddBed()}
            autoFocus
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            {BED_PRESETS.map((p) => (
              <option key={p.type} value={p.type}>
                {p.label} ({p.width}m x {p.length}m)
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleAddBed} className="flex-1 text-xs">
              {rb.addBed}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Bed list */}
      {beds.length === 0 ? (
        <p className="text-xs text-muted-foreground">{rb.noBeds}</p>
      ) : (
        <div className="space-y-1">
          {beds.map((bed) => {
            const isPlaced = placedBedIds.has(bed.id);
            const placementId = bedPlacements.find((bp) => bp.bedId === bed.id)?.id;
            const isHighlighted = placementId === selectedId;
            const preset = BED_PRESETS.find((p) => p.type === bed.bedType);

            return (
              <div
                key={bed.id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                  isHighlighted
                    ? 'bg-primary/10 ring-1 ring-primary/30'
                    : 'hover:bg-muted/50'
                }`}
                draggable={!isPlaced}
                onDragStart={(e) => handleDragStart(e, bed)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (placementId) setSelectedId(placementId);
                }}
                style={{ cursor: isPlaced ? 'pointer' : 'grab' }}
              >
                {!isPlaced && <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{bed.label}</div>
                  <div className="text-muted-foreground">
                    {preset?.label ?? bed.bedType}
                    {bed.capacity > 1 && ` (${bed.capacity}p)`}
                  </div>
                </div>
                {!isPlaced && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {rb.unplacedBed}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveBed(bed.id);
                  }}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
