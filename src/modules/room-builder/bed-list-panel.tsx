'use client';

import { useEffect, useRef, useState } from 'react';
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

/** Bed type icon as a small inline SVG */
function BedTypeIcon({ type }: { type: string }) {
  const preset = BED_PRESETS.find((p) => p.type === type);
  if (!preset) return null;

  const w = 24;
  const h = Math.round(w * (preset.length / preset.width));
  const pillows = preset.pillows;
  const isBunk = type === 'bunk_top' || type === 'bunk_bottom';
  const isBunkTop = type === 'bunk_top';

  return (
    <svg width={w} height={Math.min(h, 32)} viewBox={`0 0 ${w} ${Math.min(h, 32)}`} className="flex-shrink-0">
      {/* Bed body */}
      <rect
        x={0.5} y={0.5}
        width={w - 1} height={Math.min(h, 32) - 1}
        rx={1}
        fill="#fafaf9"
        stroke={isBunkTop ? '#a8a29e' : '#78716c'}
        strokeWidth={1}
        strokeDasharray={isBunkTop ? '3,2' : undefined}
      />
      {/* Pillow(s) */}
      {pillows === 1 && (
        <rect
          x={3} y={2}
          width={w - 6} height={5}
          rx={2}
          fill="#e8e5e3" stroke="#a8a29e" strokeWidth={0.5}
        />
      )}
      {pillows === 2 && (
        <>
          <rect
            x={2} y={2}
            width={(w - 7) / 2} height={5}
            rx={2}
            fill="#e8e5e3" stroke="#a8a29e" strokeWidth={0.5}
          />
          <rect
            x={2 + (w - 7) / 2 + 3} y={2}
            width={(w - 7) / 2} height={5}
            rx={2}
            fill="#e8e5e3" stroke="#a8a29e" strokeWidth={0.5}
          />
        </>
      )}
      {/* Bunk indicator */}
      {isBunk && (
        <text x={w / 2} y={Math.min(h, 32) - 3} textAnchor="middle" fontSize={7} fill="#a8a29e">
          {isBunkTop ? 'T' : 'B'}
        </text>
      )}
    </svg>
  );
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

  // Drag ghost state
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; type: string } | null>(null);

  // Track mouse during drag for ghost
  useEffect(() => {
    if (!dragGhost) return;
    const onMove = (e: MouseEvent) => {
      setDragGhost((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [!!dragGhost]);

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

  // Drag start — store bed info for drop onto canvas + show ghost
  const handleDragStart = (e: React.DragEvent, bed: RoomBed) => {
    dragRef.current = { bedId: bed.id, bedType: bed.bedType };
    e.dataTransfer.setData('text/plain', bed.id);
    e.dataTransfer.effectAllowed = 'copy';
    // Hide the default drag image
    const empty = document.createElement('div');
    empty.style.opacity = '0';
    document.body.appendChild(empty);
    e.dataTransfer.setDragImage(empty, 0, 0);
    setTimeout(() => document.body.removeChild(empty), 0);
    // Show custom ghost
    setDragGhost({ x: e.clientX, y: e.clientY, type: bed.bedType });
  };

  // We dispatch a custom event when dropped on the canvas area
  const handleDragEnd = (e: React.DragEvent) => {
    setDragGhost(null);
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
  const ghostPreset = dragGhost ? BED_PRESETS.find((p) => p.type === dragGhost.type) : null;

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
                <BedTypeIcon type={bed.bedType} />
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

      {/* Drag ghost — follows cursor during drag */}
      {dragGhost && ghostPreset && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: dragGhost.x - (ghostPreset.width * 40),
            top: dragGhost.y - (ghostPreset.length * 40),
          }}
        >
          <svg
            width={ghostPreset.width * 80}
            height={ghostPreset.length * 80}
            style={{ opacity: 0.7 }}
          >
            <rect
              x={1} y={1}
              width={ghostPreset.width * 80 - 2}
              height={ghostPreset.length * 80 - 2}
              rx={2}
              fill="#fafaf9"
              stroke="#3b82f6"
              strokeWidth={2}
            />
            {ghostPreset.pillows === 1 && (
              <rect
                x={ghostPreset.width * 80 * 0.1}
                y={4}
                width={ghostPreset.width * 80 * 0.8 * 0.8}
                height={10}
                rx={3}
                fill="#f5f5f4" stroke="#a8a29e" strokeWidth={0.5}
              />
            )}
            {ghostPreset.pillows === 2 && (
              <>
                <rect
                  x={ghostPreset.width * 80 * 0.06}
                  y={4}
                  width={(ghostPreset.width * 80 * 0.88 / 2 - 2) * 0.8}
                  height={10}
                  rx={3}
                  fill="#f5f5f4" stroke="#a8a29e" strokeWidth={0.5}
                />
                <rect
                  x={ghostPreset.width * 80 * 0.5 + 2}
                  y={4}
                  width={(ghostPreset.width * 80 * 0.88 / 2 - 2) * 0.8}
                  height={10}
                  rx={3}
                  fill="#f5f5f4" stroke="#a8a29e" strokeWidth={0.5}
                />
              </>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
