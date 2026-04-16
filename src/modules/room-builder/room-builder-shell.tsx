'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface LayoutSnapshot {
  shapes: LayoutShape[];
  bedPlacements: LayoutBedPlacement[];
  labels: LayoutLabel[];
  furniture: LayoutFurniture[];
}

const MAX_HISTORY = 12;

interface RoomBuilderShellProps {
  roomId: string;
  roomName: string;
  beds: RoomBed[];
  initialLayout: { layout_json: Record<string, unknown>; unit: string };
  dict: TranslationKeys;
}

export function RoomBuilderShell({
  roomId, roomName, beds: initialBeds, initialLayout, dict,
}: RoomBuilderShellProps) {
  const initJson = initialLayout.layout_json as unknown as LayoutJson;

  const [shapes, setShapes] = useState<LayoutShape[]>(() => initJson?.shapes ?? []);
  const [bedPlacements, setBedPlacements] = useState<LayoutBedPlacement[]>(() => initJson?.beds ?? []);
  const [labels, setLabels] = useState<LayoutLabel[]>(() => {
    // Migrate old labels: if fontSize > 1 it's pixels, convert to meters
    const raw = initJson?.labels ?? [];
    return raw.map((l) => l.fontSize > 1 ? { ...l, fontSize: 0.2 } : l);
  });
  const [furniture, setFurniture] = useState<LayoutFurniture[]>(() => initJson?.furniture ?? []);
  const [resortConfig, setResortConfig] = useState<ResortConfig>(() => ({
    ...DEFAULT_RESORT_CONFIG, ...(initJson?.resortConfig ?? {}),
  }));
  const [unit, setUnit] = useState<LayoutUnit>((initialLayout.unit as LayoutUnit) ?? 'meters');

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [shapePreset, setShapePreset] = useState<ShapePreset>('room');
  const [furniturePreset, setFurniturePreset] = useState<FurniturePresetType>('desk');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [beds, setBeds] = useState<RoomBed[]>(initialBeds);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasMountedRef = useRef(false);

  // Undo/Redo
  const [history, setHistory] = useState<LayoutSnapshot[]>(() => [{
    shapes: initJson?.shapes ?? [], bedPlacements: initJson?.beds ?? [],
    labels: initJson?.labels ?? [], furniture: initJson?.furniture ?? [],
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    if (isUndoRedoRef.current) { isUndoRedoRef.current = false; return; }
    setHasUnsavedChanges(true);
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const snapshot: LayoutSnapshot = { shapes, bedPlacements, labels, furniture };
      const idx = historyIndexRef.current;
      setHistory((prev) => {
        const trimmed = prev.slice(0, idx + 1);
        const next = [...trimmed, snapshot];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    }, 300);
    return () => { if (historyTimerRef.current) clearTimeout(historyTimerRef.current); };
  }, [shapes, bedPlacements, labels, furniture]); // eslint-disable-line react-hooks/exhaustive-deps

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const s = history[historyIndex - 1];
    isUndoRedoRef.current = true; setShapes(s.shapes);
    isUndoRedoRef.current = true; setBedPlacements(s.bedPlacements);
    isUndoRedoRef.current = true; setLabels(s.labels);
    isUndoRedoRef.current = true; setFurniture(s.furniture);
    setHistoryIndex(historyIndex - 1); historyIndexRef.current = historyIndex - 1;
    setHasUnsavedChanges(true);
  }, [canUndo, historyIndex, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const s = history[historyIndex + 1];
    isUndoRedoRef.current = true; setShapes(s.shapes);
    isUndoRedoRef.current = true; setBedPlacements(s.bedPlacements);
    isUndoRedoRef.current = true; setLabels(s.labels);
    isUndoRedoRef.current = true; setFurniture(s.furniture);
    setHistoryIndex(historyIndex + 1); historyIndexRef.current = historyIndex + 1;
    setHasUnsavedChanges(true);
  }, [canRedo, historyIndex, history]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const layoutJson: LayoutJson = { shapes, beds: bedPlacements, labels, furniture, resortConfig };
      await fetch(`/api/admin/rooms/${roomId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layoutJson, unit }),
      });
      setSaveStatus('saved'); setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('idle'); }
  };

  const placedBedIds = new Set(bedPlacements.map((bp) => bp.bedId));

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rooms">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />{dict.roomBuilder.back}</Button>
          </Link>
          <h1 className="text-lg font-semibold">{roomName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)" className="bg-white border-foreground/80 hover:bg-muted"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)" className="bg-white border-foreground/80 hover:bg-muted"><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" onClick={handleSave} disabled={saveStatus === 'saving' || !hasUnsavedChanges} className="min-w-[80px]">
            <Save className="mr-1 h-4 w-4" />
            {saveStatus === 'saving' ? dict.roomBuilder.saving : saveStatus === 'saved' ? dict.roomBuilder.saved : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden bg-muted/30">
          <BuilderCanvas
            shapes={shapes} setShapes={setShapes}
            bedPlacements={bedPlacements} setBedPlacements={setBedPlacements}
            labels={labels} setLabels={setLabels}
            furniture={furniture} setFurniture={setFurniture}
            beds={beds} setBeds={setBeds} roomId={roomId}
            unit={unit} activeTool={activeTool}
            shapePreset={shapePreset} furniturePreset={furniturePreset}
            selectedId={selectedId} setSelectedId={setSelectedId}
            setActiveTool={setActiveTool}
            resortConfig={resortConfig}
          />
        </div>

        <div className="flex w-80 flex-col border-l bg-background overflow-y-auto">
          <ResortPanel config={resortConfig} setConfig={setResortConfig} unit={unit} dict={dict} />
          <BedListPanel roomId={roomId} beds={beds} setBeds={setBeds} placedBedIds={placedBedIds}
            selectedId={selectedId} setSelectedId={setSelectedId} bedPlacements={bedPlacements} dict={dict} />
          <div className="border-t">
            <ToolPanel activeTool={activeTool} setActiveTool={setActiveTool}
              shapePreset={shapePreset} setShapePreset={setShapePreset}
              furniturePreset={furniturePreset} setFurniturePreset={setFurniturePreset}
              unit={unit} setUnit={setUnit} selectedId={selectedId} shapes={shapes} setShapes={setShapes} dict={dict} />
          </div>
        </div>
      </div>
    </div>
  );
}
