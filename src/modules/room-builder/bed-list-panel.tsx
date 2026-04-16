'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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

/** Bed icon SVG — proportional to actual bed dimensions, correct pillow count */
function BedTypeIcon({ type }: { type: string }) {
  const preset = BED_PRESETS.find((p) => p.type === type);
  if (!preset) return null;
  const maxDim = 32;
  const ratio = preset.width / preset.length;
  const iconH = ratio >= 1 ? maxDim / ratio : maxDim;
  const iconW = ratio >= 1 ? maxDim : maxDim * ratio;
  const pillows = preset.pillows;
  const isBunkTop = type === 'bunk_top';
  const isBunk = type === 'bunk_top' || type === 'bunk_bottom';
  const pad = 1;
  const pillowH = 4;
  const pillowY = pad + 1;
  const pillowGap = 2;

  return (
    <svg width={iconW} height={iconH} viewBox={`0 0 ${iconW} ${iconH}`} className="flex-shrink-0">
      <rect x={pad} y={pad} width={iconW - pad * 2} height={iconH - pad * 2} rx={1.5}
        fill="#fafaf9" stroke={isBunkTop ? '#a8a29e' : '#78716c'} strokeWidth={1}
        strokeDasharray={isBunkTop ? '3,2' : undefined} />
      {pillows === 1 && (
        <rect x={pad + 2} y={pillowY} width={iconW - pad * 2 - 4} height={pillowH}
          rx={1.5} fill="#e8e5e3" stroke="#a8a29e" strokeWidth={0.5} />
      )}
      {pillows === 2 && (() => {
        const pw = (iconW - pad * 2 - 4 - pillowGap) / 2;
        return (
          <>
            <rect x={pad + 2} y={pillowY} width={pw} height={pillowH}
              rx={1.5} fill="#e8e5e3" stroke="#a8a29e" strokeWidth={0.5} />
            <rect x={pad + 2 + pw + pillowGap} y={pillowY} width={pw} height={pillowH}
              rx={1.5} fill="#e8e5e3" stroke="#a8a29e" strokeWidth={0.5} />
          </>
        );
      })()}
      {isBunk && (
        <text x={iconW / 2} y={iconH - 3} textAnchor="middle" fontSize={7} fill="#a8a29e">
          {isBunkTop ? 'T' : 'B'}
        </text>
      )}
    </svg>
  );
}

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BedListPanel({
  roomId, beds, setBeds, placedBedIds, selectedId, setSelectedId, bedPlacements, dict,
}: BedListPanelProps) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('single');
  const dragRef = useRef<{ bedId: string; bedType: string } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; type: string } | null>(null);
  const [editingBed, setEditingBed] = useState<{ id: string; label: string; bedType: string } | null>(null);

  useEffect(() => {
    if (!dragGhost) return;
    const onMove = (e: MouseEvent) => setDragGhost((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [!!dragGhost]);

  // ── ALL modifications are local state only — no API calls ──

  const handleAddBed = () => {
    if (!newLabel.trim()) return;
    const preset = BED_PRESETS.find((p) => p.type === newType);
    setBeds((prev) => [...prev, {
      id: generateTempId(),
      label: newLabel.trim(),
      bedType: newType,
      capacity: preset?.capacity ?? 1,
      widthM: preset?.width ?? 1.0,
      lengthM: preset?.length ?? 1.9,
    }]);
    setNewLabel('');
    setAdding(false);
  };

  const handleRemoveBed = (bedId: string) => {
    setBeds((prev) => prev.filter((b) => b.id !== bedId));
  };

  const handleSaveEdit = () => {
    if (!editingBed || !editingBed.label.trim()) return;
    const preset = BED_PRESETS.find((p) => p.type === editingBed.bedType);
    setBeds((prev) => prev.map((b) => b.id === editingBed.id
      ? { ...b, label: editingBed.label.trim(), bedType: editingBed.bedType, capacity: preset?.capacity ?? b.capacity, widthM: preset?.width ?? b.widthM, lengthM: preset?.length ?? b.lengthM }
      : b));
    setEditingBed(null);
  };

  const handleDragStart = (e: React.DragEvent, bed: RoomBed) => {
    dragRef.current = { bedId: bed.id, bedType: bed.bedType };
    e.dataTransfer.setData('text/plain', bed.id);
    e.dataTransfer.effectAllowed = 'copy';
    const empty = document.createElement('div'); empty.style.opacity = '0';
    document.body.appendChild(empty); e.dataTransfer.setDragImage(empty, 0, 0);
    setTimeout(() => document.body.removeChild(empty), 0);
    setDragGhost({ x: e.clientX, y: e.clientY, type: bed.bedType });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDragGhost(null);
    if (dragRef.current) {
      window.dispatchEvent(new CustomEvent('room-builder-drop-bed', { detail: { ...dragRef.current, x: e.clientX, y: e.clientY } }));
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

      {adding && (
        <div className="mb-3 rounded-md border p-2 space-y-2">
          <input type="text" placeholder="Bed label (e.g., Main 1)" value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddBed()} autoFocus />
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {BED_PRESETS.map((p) => <option key={p.type} value={p.type}>{p.label} ({p.width}m x {p.length}m)</option>)}
          </select>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleAddBed} className="flex-1 text-xs">{rb.addBed}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="text-xs">Cancel</Button>
          </div>
        </div>
      )}

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
              <div key={bed.id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${isHighlighted ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}
                draggable={!isPlaced}
                onDragStart={(e) => handleDragStart(e, bed)}
                onDragEnd={handleDragEnd}
                onClick={() => { if (placementId) setSelectedId(placementId); }}
                onContextMenu={(e) => { e.preventDefault(); setEditingBed({ id: bed.id, label: bed.label, bedType: bed.bedType }); }}
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
                {!isPlaced && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{rb.unplacedBed}</span>}
                <button onClick={(e) => { e.stopPropagation(); handleRemoveBed(bed.id); }}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drag ghost */}
      {dragGhost && ghostPreset && (
        <div className="fixed pointer-events-none z-50"
          style={{ left: dragGhost.x - (ghostPreset.width * 40), top: dragGhost.y - (ghostPreset.length * 40) }}>
          <svg width={ghostPreset.width * 80} height={ghostPreset.length * 80} style={{ opacity: 0.7 }}>
            <rect x={1} y={1} width={ghostPreset.width * 80 - 2} height={ghostPreset.length * 80 - 2}
              rx={2} fill="#fafaf9" stroke="#3b82f6" strokeWidth={2} />
          </svg>
        </div>
      )}

      {/* Right-click edit modal */}
      <Dialog open={!!editingBed} onOpenChange={(open) => { if (!open) setEditingBed(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Edit Bed</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bed Name</label>
              <input type="text" value={editingBed?.label ?? ''} autoFocus
                onChange={(e) => setEditingBed((p) => p ? { ...p, label: e.target.value } : null)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bed Type</label>
              <select value={editingBed?.bedType ?? 'single'}
                onChange={(e) => setEditingBed((p) => p ? { ...p, bedType: e.target.value } : null)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50">
                {BED_PRESETS.map((p) => <option key={p.type} value={p.type}>{p.label} ({p.width}m x {p.length}m)</option>)}
              </select>
            </div>
            {editingBed && <div className="flex items-center justify-center py-2"><BedTypeIcon type={editingBed.bedType} /></div>}
            <Button size="sm" onClick={handleSaveEdit} className="w-full">Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
