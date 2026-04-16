'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BuilderCanvas } from './builder-canvas';
import { BedListPanel } from './bed-list-panel';
import { ToolPanel } from './tool-panel';
import { ResortPanel } from './resort-panel';
import {
  DEFAULT_RESORT_CONFIG,
  type LayoutJson, type LayoutShape, type LayoutBedPlacement, type LayoutLabel,
  type LayoutFurniture, type LayoutUnit, type ResortConfig,
} from './types';
import type { TranslationKeys } from '@/i18n/en';

// ── Public types ──

export interface RoomBed {
  id: string;
  label: string;
  bedType: string;
  capacity: number;
  widthM: number | null;
  lengthM: number | null;
}

export type ActiveTool = 'select' | 'rectangle' | 'text' | 'furniture';
export type ShapePreset = 'room' | 'bathroom' | 'deck' | 'loft';
export type FurniturePresetType = 'desk' | 'nightstand' | 'shelves' | 'planter';

// ── Unified state ──

interface BuilderState {
  shapes: LayoutShape[];
  bedPlacements: LayoutBedPlacement[];
  labels: LayoutLabel[];
  furniture: LayoutFurniture[];
  beds: RoomBed[];
  resortConfig: ResortConfig;
  unit: LayoutUnit;
}

const MAX_HISTORY = 12;

// ── Props ──

interface RoomBuilderShellProps {
  roomId: string;
  roomName: string;
  beds: RoomBed[];
  initialLayout: { layout_json: Record<string, unknown>; unit: string };
  dict: TranslationKeys;
}

function buildInitialState(initialLayout: RoomBuilderShellProps['initialLayout'], initialBeds: RoomBed[]): BuilderState {
  const json = initialLayout.layout_json as unknown as LayoutJson;
  return {
    shapes: json?.shapes ?? [],
    bedPlacements: json?.beds ?? [],
    labels: (json?.labels ?? []).map((l) => l.fontSize > 1 ? { ...l, fontSize: 0.2 } : l),
    furniture: json?.furniture ?? [],
    beds: initialBeds,
    resortConfig: { ...DEFAULT_RESORT_CONFIG, ...(json?.resortConfig ?? {}) },
    unit: (initialLayout.unit as LayoutUnit) ?? 'meters',
  };
}

export function RoomBuilderShell({ roomId, roomName, beds: initialBeds, initialLayout, dict }: RoomBuilderShellProps) {
  const router = useRouter();

  // ── Single source of truth ──
  const [state, setState] = useState<BuilderState>(() => buildInitialState(initialLayout, initialBeds));

  // ── Dirty detection: compare against last-saved snapshot ──
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(buildInitialState(initialLayout, initialBeds)));
  const isDirty = useMemo(() => JSON.stringify(state) !== savedSnapshot, [state, savedSnapshot]);

  // ── Convenience setters (pass to children — same API as before) ──
  const setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, shapes: typeof fn === 'function' ? fn(prev.shapes) : fn })), []);
  const setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, bedPlacements: typeof fn === 'function' ? fn(prev.bedPlacements) : fn })), []);
  const setLabels: React.Dispatch<React.SetStateAction<LayoutLabel[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, labels: typeof fn === 'function' ? fn(prev.labels) : fn })), []);
  const setFurniture: React.Dispatch<React.SetStateAction<LayoutFurniture[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, furniture: typeof fn === 'function' ? fn(prev.furniture) : fn })), []);
  const setBeds: React.Dispatch<React.SetStateAction<RoomBed[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, beds: typeof fn === 'function' ? fn(prev.beds) : fn })), []);
  const setResortConfig = useCallback(
    (config: ResortConfig) => setState((prev) => ({ ...prev, resortConfig: config })), []);
  const setUnit = useCallback(
    (unit: LayoutUnit) => setState((prev) => ({ ...prev, unit })), []);

  // ── Tool state (not saved, not in undo) ──
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [shapePreset, setShapePreset] = useState<ShapePreset>('room');
  const [furniturePreset, setFurniturePreset] = useState<FurniturePresetType>('desk');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // ── Undo/Redo: full BuilderState snapshots ──
  const [history, setHistory] = useState<BuilderState[]>(() => [buildInitialState(initialLayout, initialBeds)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  // Record history on ANY state change (debounced 300ms)
  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    if (isUndoRedoRef.current) { isUndoRedoRef.current = false; return; }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const idx = historyIndexRef.current;
      setHistory((prev) => {
        const trimmed = prev.slice(0, idx + 1);
        const next = [...trimmed, state];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    }, 300);
    return () => { if (historyTimerRef.current) clearTimeout(historyTimerRef.current); };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const snapshot = history[historyIndex - 1];
    isUndoRedoRef.current = true;
    setState(snapshot);
    setHistoryIndex(historyIndex - 1);
    historyIndexRef.current = historyIndex - 1;
  }, [canUndo, historyIndex, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const snapshot = history[historyIndex + 1];
    isUndoRedoRef.current = true;
    setState(snapshot);
    setHistoryIndex(historyIndex + 1);
    historyIndexRef.current = historyIndex + 1;
  }, [canRedo, historyIndex, history]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Browser beforeunload guard ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Save: persist EVERYTHING in one operation ──
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const { shapes, bedPlacements, labels, furniture, resortConfig, unit, beds } = state;

      // 1. Save layout
      const layoutJson: LayoutJson = { shapes, beds: bedPlacements, labels, furniture, resortConfig };
      await fetch(`/api/admin/rooms/${roomId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layoutJson, unit }),
      });

      // 2. Sync beds to DB — diff against initial to find adds/deletes/updates
      const initialIds = new Set(initialBeds.map((b) => b.id));
      const currentIds = new Set(beds.map((b) => b.id));

      // New beds (temp IDs or IDs not in initial)
      const newBeds = beds.filter((b) => !initialIds.has(b.id) || b.id.startsWith('temp-'));
      // Deleted beds
      const deletedIds = initialBeds.filter((b) => !currentIds.has(b.id)).map((b) => b.id);
      // Modified beds (exist in both, check if changed)
      const modifiedBeds = beds.filter((b) => {
        if (!initialIds.has(b.id) || b.id.startsWith('temp-')) return false;
        const orig = initialBeds.find((ob) => ob.id === b.id);
        return orig && (orig.label !== b.label || orig.bedType !== b.bedType);
      });

      const ops: Promise<unknown>[] = [];

      for (const bed of newBeds) {
        ops.push(
          fetch(`/api/admin/rooms/${roomId}/beds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: bed.label, bed_type: bed.bedType, capacity: bed.capacity, width_m: bed.widthM, length_m: bed.lengthM }),
          }).then(async (res) => {
            if (res.ok) {
              const { bed: dbBed } = await res.json();
              // Replace temp ID with real ID in state
              setState((prev) => ({
                ...prev,
                beds: prev.beds.map((b) => b.id === bed.id ? { ...b, id: dbBed.id } : b),
                bedPlacements: prev.bedPlacements.map((bp) => bp.bedId === bed.id ? { ...bp, bedId: dbBed.id } : bp),
              }));
            }
          }).catch(() => {}),
        );
      }

      for (const id of deletedIds) {
        ops.push(fetch(`/api/admin/rooms/${roomId}/beds?bedId=${id}`, { method: 'DELETE' }).catch(() => {}));
      }

      for (const bed of modifiedBeds) {
        ops.push(
          fetch(`/api/admin/rooms/${roomId}/beds`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bedId: bed.id, label: bed.label, bed_type: bed.bedType }),
          }).catch(() => {}),
        );
      }

      await Promise.all(ops);

      setSavedSnapshot(JSON.stringify(state));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  // ── Navigation guard ──
  const handleBack = () => {
    if (isDirty) { setShowLeaveDialog(true); return; }
    router.push('/dashboard/rooms');
  };

  const handleSaveAndLeave = async () => {
    setShowLeaveDialog(false);
    await handleSave();
    router.push('/dashboard/rooms');
  };

  const handleAbandonAndLeave = () => {
    setShowLeaveDialog(false);
    router.push('/dashboard/rooms');
  };

  // ── Derived values ──
  const placedBedIds = useMemo(() => new Set(state.bedPlacements.map((bp) => bp.bedId)), [state.bedPlacements]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />{dict.roomBuilder.back}
          </Button>
          <h1 className="text-lg font-semibold">{roomName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)"
            className="bg-white border-foreground/80 hover:bg-muted"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)"
            className="bg-white border-foreground/80 hover:bg-muted"><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" onClick={handleSave} disabled={saveStatus === 'saving'}
            className={`min-w-[80px] ${isDirty ? '' : 'opacity-70'}`}>
            <Save className="mr-1 h-4 w-4" />
            {saveStatus === 'saving' ? dict.roomBuilder.saving : saveStatus === 'saved' ? dict.roomBuilder.saved : 'Save'}
          </Button>
        </div>
      </div>

      {/* Canvas + Right panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden bg-muted/30">
          <BuilderCanvas
            shapes={state.shapes} setShapes={setShapes}
            bedPlacements={state.bedPlacements} setBedPlacements={setBedPlacements}
            labels={state.labels} setLabels={setLabels}
            furniture={state.furniture} setFurniture={setFurniture}
            beds={state.beds} setBeds={setBeds} roomId={roomId}
            unit={state.unit} activeTool={activeTool}
            shapePreset={shapePreset} furniturePreset={furniturePreset}
            selectedId={selectedId} setSelectedId={setSelectedId}
            setActiveTool={setActiveTool} resortConfig={state.resortConfig}
          />
        </div>

        <div className="flex w-80 flex-col border-l bg-background overflow-y-auto">
          <ResortPanel config={state.resortConfig} setConfig={setResortConfig} unit={state.unit} dict={dict} />
          <BedListPanel roomId={roomId} beds={state.beds} setBeds={setBeds} placedBedIds={placedBedIds}
            selectedId={selectedId} setSelectedId={setSelectedId} bedPlacements={state.bedPlacements} dict={dict} />
          <div className="border-t">
            <ToolPanel activeTool={activeTool} setActiveTool={setActiveTool}
              shapePreset={shapePreset} setShapePreset={setShapePreset}
              furniturePreset={furniturePreset} setFurniturePreset={setFurniturePreset}
              unit={state.unit} setUnit={setUnit} selectedId={selectedId}
              shapes={state.shapes} setShapes={setShapes} dict={dict} />
          </div>
        </div>
      </div>

      {/* Unsaved changes dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={(open) => { if (!open) setShowLeaveDialog(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>You have unsaved changes to the {roomName} Room</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleAbandonAndLeave}>Abandon Changes</Button>
            <Button onClick={handleSaveAndLeave}>Save Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
