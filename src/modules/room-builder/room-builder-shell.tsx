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
  type LayoutFurniture, type LayoutOpening, type LayoutArrow, type LayoutUnit, type ResortConfig,
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

export type ActiveTool = 'select' | 'rectangle' | 'text' | 'furniture' | 'door' | 'window' | 'arrow';
export type ShapePreset = 'room' | 'bathroom' | 'deck' | 'loft';
export type FurniturePresetType = 'desk' | 'nightstand' | 'shelves' | 'planter';

// ── Unified state ──

interface BuilderState {
  shapes: LayoutShape[];
  bedPlacements: LayoutBedPlacement[];
  labels: LayoutLabel[];
  furniture: LayoutFurniture[];
  openings: LayoutOpening[];
  arrows: LayoutArrow[];
  beds: RoomBed[];
  resortConfig: ResortConfig;
  unit: LayoutUnit;
}

const MAX_HISTORY = 20;

// ── Props ──

interface RoomBuilderShellProps {
  roomId: string;
  roomName: string;
  beds: RoomBed[];
  initialLayout: { layout_json: Record<string, unknown>; unit: string };
  dict: TranslationKeys;
}

/** Migrate old flat ResortConfig to new per-type TextStyle format */
function migrateResortConfig(raw: unknown): ResortConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_RESORT_CONFIG;
  const r = raw as Record<string, unknown>;
  // New format has .title.fontFamily
  if (r.title && typeof r.title === 'object') {
    return { ...DEFAULT_RESORT_CONFIG, ...r } as ResortConfig;
  }
  // Old flat format: { fontFamily, titleFontSize, infoFontSize, furnitureFontSize }
  const ff = (r.fontFamily as string) ?? 'Arial';
  return {
    title:     { ...DEFAULT_RESORT_CONFIG.title, fontFamily: ff, fontSize: (r.titleFontSize as number) ?? 0.3 },
    info:      { ...DEFAULT_RESORT_CONFIG.info, fontFamily: ff, fontSize: (r.infoFontSize as number) ?? 0.2 },
    furniture: { ...DEFAULT_RESORT_CONFIG.furniture, fontFamily: ff, fontSize: (r.furnitureFontSize as number) ?? 0.15 },
  };
}

function buildInitialState(initialLayout: RoomBuilderShellProps['initialLayout'], initialBeds: RoomBed[]): BuilderState {
  const json = initialLayout.layout_json as unknown as LayoutJson;
  return {
    shapes: json?.shapes ?? [],
    bedPlacements: json?.beds ?? [],
    labels: (json?.labels ?? []).map((l) => l.fontSize > 1 ? { ...l, fontSize: 0.2 } : l),
    furniture: json?.furniture ?? [],
    openings: json?.openings ?? [],
    arrows: json?.arrows ?? [],
    beds: initialBeds,
    resortConfig: migrateResortConfig(json?.resortConfig),
    unit: (initialLayout.unit as LayoutUnit) ?? 'meters',
  };
}

export function RoomBuilderShell({ roomId, roomName, beds: initialBeds, initialLayout, dict }: RoomBuilderShellProps) {
  const router = useRouter();

  // FIX #8: Build initial state ONCE, reuse for state + snapshot + history
  const [initialState] = useState(() => buildInitialState(initialLayout, initialBeds));

  // ── Single source of truth ──
  const [state, setState] = useState<BuilderState>(initialState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Dirty detection ──
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialState));
  const isDirty = useMemo(() => JSON.stringify(state) !== savedSnapshot, [state, savedSnapshot]);

  // FIX #1: Track the "last saved" beds for diffing (not the initial prop)
  const savedBedsRef = useRef<RoomBed[]>(initialBeds);

  // ── Convenience setters ──
  const setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, shapes: typeof fn === 'function' ? fn(prev.shapes) : fn })), []);
  const setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, bedPlacements: typeof fn === 'function' ? fn(prev.bedPlacements) : fn })), []);
  const setLabels: React.Dispatch<React.SetStateAction<LayoutLabel[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, labels: typeof fn === 'function' ? fn(prev.labels) : fn })), []);
  const setFurniture: React.Dispatch<React.SetStateAction<LayoutFurniture[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, furniture: typeof fn === 'function' ? fn(prev.furniture) : fn })), []);
  const setOpenings: React.Dispatch<React.SetStateAction<LayoutOpening[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, openings: typeof fn === 'function' ? fn(prev.openings) : fn })), []);
  const setArrows: React.Dispatch<React.SetStateAction<LayoutArrow[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, arrows: typeof fn === 'function' ? fn(prev.arrows) : fn })), []);
  const setBeds: React.Dispatch<React.SetStateAction<RoomBed[]>> = useCallback(
    (fn) => setState((prev) => ({ ...prev, beds: typeof fn === 'function' ? fn(prev.beds) : fn })), []);
  const setResortConfig = useCallback(
    (config: ResortConfig) => setState((prev) => ({ ...prev, resortConfig: config })), []);
  const setUnit = useCallback(
    (unit: LayoutUnit) => setState((prev) => ({ ...prev, unit })), []);

  // ── Tool state ──
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [shapePreset, setShapePreset] = useState<ShapePreset>('room');
  const [furniturePreset, setFurniturePreset] = useState<FurniturePresetType>('desk');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(() => {
    const json = initialLayout.layout_json as unknown as { thumbnail?: string };
    return json?.thumbnail ?? null;
  });

  // ── Undo/Redo ──
  const [history, setHistory] = useState<BuilderState[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const isInternalUpdateRef = useRef(false); // FIX #3: skip history for internal updates (undo, redo, save ID replacement)
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  // Record history on state change (debounced 300ms)
  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    if (isInternalUpdateRef.current) { isInternalUpdateRef.current = false; return; }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const idx = historyIndexRef.current;
      const currentState = stateRef.current;
      setHistory((prev) => {
        const trimmed = prev.slice(0, idx + 1);
        trimmed.push(currentState);
        // FIX #4: Compute correct index inside the updater where we know the final length
        if (trimmed.length > MAX_HISTORY) trimmed.shift();
        return trimmed;
      });
      // FIX #4: Always point to the last entry
      setHistoryIndex((prev) => {
        const newLen = Math.min(prev + 2, MAX_HISTORY); // +1 for the push, capped
        return newLen - 1;
      });
    }, 300);
    return () => { if (historyTimerRef.current) clearTimeout(historyTimerRef.current); };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const canUndo = historyIndex > 0 && saveStatus !== 'saving'; // FIX #5: disable during save
  const canRedo = historyIndex < history.length - 1 && saveStatus !== 'saving';

  const undo = useCallback(() => {
    if (!canUndo) return;
    const snapshot = history[historyIndex - 1];
    isInternalUpdateRef.current = true;
    setState(snapshot);
    setHistoryIndex(historyIndex - 1);
    historyIndexRef.current = historyIndex - 1;
  }, [canUndo, historyIndex, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const snapshot = history[historyIndex + 1];
    isInternalUpdateRef.current = true;
    setState(snapshot);
    setHistoryIndex(historyIndex + 1);
    historyIndexRef.current = historyIndex + 1;
  }, [canRedo, historyIndex, history]);

  // ── Save ──
  // FIX #6: Use ref to always call the latest handleSave
  const handleSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  handleSaveRef.current = async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      const current = stateRef.current; // Always read latest state
      const { shapes, bedPlacements, labels, furniture, openings, arrows, resortConfig, unit, beds } = current;

      // 1. Save layout
      const layoutJson: LayoutJson = { shapes, beds: bedPlacements, labels, furniture, openings, arrows, resortConfig };
      const layoutRes = await fetch(`/api/admin/rooms/${roomId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layoutJson, unit }),
      });
      if (!layoutRes.ok) throw new Error('Layout save failed');

      // 2. Sync beds — diff against LAST SAVED (not initial prop)
      const savedBeds = savedBedsRef.current;
      const savedIds = new Set(savedBeds.map((b) => b.id));
      const currentIds = new Set(beds.map((b) => b.id));

      const newBeds = beds.filter((b) => !savedIds.has(b.id));
      const deletedIds = savedBeds.filter((b) => !currentIds.has(b.id)).map((b) => b.id);
      // FIX #7: Check all mutable fields
      const modifiedBeds = beds.filter((b) => {
        if (!savedIds.has(b.id)) return false;
        const orig = savedBeds.find((ob) => ob.id === b.id);
        if (!orig) return false;
        return orig.label !== b.label || orig.bedType !== b.bedType
          || orig.capacity !== b.capacity || orig.widthM !== b.widthM || orig.lengthM !== b.lengthM;
      });

      // FIX #9: Use allSettled to detect failures
      const ops: Promise<{ ok: boolean; tempId?: string; realId?: string }>[] = [];

      for (const bed of newBeds) {
        ops.push(
          fetch(`/api/admin/rooms/${roomId}/beds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: bed.label, bed_type: bed.bedType, capacity: bed.capacity, width_m: bed.widthM, length_m: bed.lengthM }),
          }).then(async (res) => {
            if (!res.ok) return { ok: false };
            const { bed: dbBed } = await res.json();
            return { ok: true, tempId: bed.id, realId: dbBed.id as string };
          }).catch(() => ({ ok: false })),
        );
      }

      for (const id of deletedIds) {
        ops.push(fetch(`/api/admin/rooms/${roomId}/beds?bedId=${id}`, { method: 'DELETE' })
          .then((r) => ({ ok: r.ok })).catch(() => ({ ok: false })));
      }

      for (const bed of modifiedBeds) {
        ops.push(
          fetch(`/api/admin/rooms/${roomId}/beds`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bedId: bed.id, label: bed.label, bed_type: bed.bedType }),
          }).then((r) => ({ ok: r.ok })).catch(() => ({ ok: false })),
        );
      }

      const results = await Promise.all(ops);

      // FIX #2 + #3: Replace temp IDs and update savedSnapshot AFTER all mutations, as one internal update
      const idReplacements = results.filter((r): r is { ok: true; tempId: string; realId: string } => r.ok && !!r.tempId && !!r.realId);

      if (idReplacements.length > 0) {
        isInternalUpdateRef.current = true; // FIX #3: Don't create undo entry
        setState((prev) => {
          let { beds: b, bedPlacements: bp } = prev;
          for (const { tempId, realId } of idReplacements) {
            b = b.map((bed) => bed.id === tempId ? { ...bed, id: realId } : bed);
            bp = bp.map((p) => p.bedId === tempId ? { ...p, bedId: realId } : p);
          }
          return { ...prev, beds: b, bedPlacements: bp };
        });
      }

      // FIX #2: Read state AFTER ID replacements via ref (on next tick)
      await new Promise((r) => setTimeout(r, 0));
      const finalState = stateRef.current;
      setSavedSnapshot(JSON.stringify(finalState));
      savedBedsRef.current = finalState.beds; // FIX #1: Update "last saved" beds

      const anyFailed = results.some((r) => !r.ok);
      setSaveStatus(anyFailed ? 'idle' : 'saved');
      if (!anyFailed) {
        // Generate thumbnail after successful save
        setTimeout(() => window.dispatchEvent(new Event('room-builder-generate-thumb')), 100);
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch {
      setSaveStatus('idle');
    }
  };

  const handleSave = useCallback(() => handleSaveRef.current?.() ?? Promise.resolve(), []);

  // Save thumbnail when generated
  const handleThumbnailGenerated = useCallback(async (dataUrl: string) => {
    setThumbnail(dataUrl);
    // Persist to layout_json
    try {
      const current = stateRef.current;
      const layoutJson = { shapes: current.shapes, beds: current.bedPlacements, labels: current.labels, furniture: current.furniture, openings: current.openings, arrows: current.arrows, resortConfig: current.resortConfig, thumbnail: dataUrl };
      await fetch(`/api/admin/rooms/${roomId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layoutJson, unit: current.unit }),
      });
    } catch { /* thumbnail save failure is non-fatal */ }
  }, [roomId]);

  // ── Keyboard shortcuts ──
  // FIX #6: handleSave via ref, always latest
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSaveRef.current?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ── Browser beforeunload guard ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

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

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden bg-muted/30">
          <BuilderCanvas
            shapes={state.shapes} setShapes={setShapes}
            bedPlacements={state.bedPlacements} setBedPlacements={setBedPlacements}
            labels={state.labels} setLabels={setLabels}
            furniture={state.furniture} setFurniture={setFurniture}
            openings={state.openings} setOpenings={setOpenings}
            arrows={state.arrows} setArrows={setArrows}
            beds={state.beds} setBeds={setBeds} roomId={roomId}
            unit={state.unit} activeTool={activeTool}
            shapePreset={shapePreset} furniturePreset={furniturePreset}
            selectedId={selectedId} setSelectedId={setSelectedId}
            setActiveTool={setActiveTool} resortConfig={state.resortConfig}
            thumbnail={thumbnail} onThumbnailGenerated={handleThumbnailGenerated}
          />
        </div>

        <div className="flex w-80 flex-col border-l bg-background overflow-y-auto">
          <ResortPanel config={state.resortConfig} setConfig={setResortConfig} unit={state.unit} />
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
