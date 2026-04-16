'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuilderCanvas } from './builder-canvas';
import { BedListPanel } from './bed-list-panel';
import { ToolPanel } from './tool-panel';
import type { LayoutJson, LayoutShape, LayoutBedPlacement, LayoutLabel, LayoutUnit } from './types';
import type { TranslationKeys } from '@/i18n/en';

export interface RoomBed {
  id: string;
  label: string;
  bedType: string;
  capacity: number;
  widthM: number | null;
  lengthM: number | null;
}

export type ActiveTool = 'select' | 'rectangle' | 'text';
export type ShapePreset = 'room' | 'bathroom' | 'deck' | 'loft';

interface LayoutSnapshot {
  shapes: LayoutShape[];
  bedPlacements: LayoutBedPlacement[];
  labels: LayoutLabel[];
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
  roomId,
  roomName,
  beds: initialBeds,
  initialLayout,
  dict,
}: RoomBuilderShellProps) {
  // Layout state
  const [shapes, setShapes] = useState<LayoutShape[]>(
    () => (initialLayout.layout_json as unknown as LayoutJson)?.shapes ?? [],
  );
  const [bedPlacements, setBedPlacements] = useState<LayoutBedPlacement[]>(
    () => (initialLayout.layout_json as unknown as LayoutJson)?.beds ?? [],
  );
  const [labels, setLabels] = useState<LayoutLabel[]>(
    () => (initialLayout.layout_json as unknown as LayoutJson)?.labels ?? [],
  );
  const [unit, setUnit] = useState<LayoutUnit>(
    (initialLayout.unit as LayoutUnit) ?? 'meters',
  );

  // Tool state
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [shapePreset, setShapePreset] = useState<ShapePreset>('room');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Bed state (from DB)
  const [beds, setBeds] = useState<RoomBed[]>(initialBeds);

  // Save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasMountedRef = useRef(false);

  // Undo/Redo history
  const [history, setHistory] = useState<LayoutSnapshot[]>(() => [{
    shapes: (initialLayout.layout_json as unknown as LayoutJson)?.shapes ?? [],
    bedPlacements: (initialLayout.layout_json as unknown as LayoutJson)?.beds ?? [],
    labels: (initialLayout.layout_json as unknown as LayoutJson)?.labels ?? [],
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  // Record history on state changes
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    const snapshot: LayoutSnapshot = { shapes, bedPlacements, labels };
    const currentIdx = historyIndexRef.current;
    setHistory((prev) => {
      // Trim any redo entries after current index
      const trimmed = prev.slice(0, currentIdx + 1);
      const next = [...trimmed, snapshot];
      // Cap at MAX_HISTORY
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIndex((prev) => {
      const newIdx = Math.min(prev + 1, MAX_HISTORY - 1);
      return newIdx;
    });
    setHasUnsavedChanges(true);
  }, [shapes, bedPlacements, labels]); // eslint-disable-line react-hooks/exhaustive-deps

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    const snapshot = history[newIndex];
    isUndoRedoRef.current = true;
    setShapes(snapshot.shapes);
    isUndoRedoRef.current = true;
    setBedPlacements(snapshot.bedPlacements);
    isUndoRedoRef.current = true;
    setLabels(snapshot.labels);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
    setHasUnsavedChanges(true);
  }, [canUndo, historyIndex, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    const snapshot = history[newIndex];
    isUndoRedoRef.current = true;
    setShapes(snapshot.shapes);
    isUndoRedoRef.current = true;
    setBedPlacements(snapshot.bedPlacements);
    isUndoRedoRef.current = true;
    setLabels(snapshot.labels);
    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex;
    setHasUnsavedChanges(true);
  }, [canRedo, historyIndex, history]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual save
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const layoutJson: LayoutJson = { shapes, beds: bedPlacements, labels };
      await fetch(`/api/admin/rooms/${roomId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layoutJson, unit }),
      });
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  // Find which bed IDs are already placed on canvas
  const placedBedIds = new Set(bedPlacements.map((bp) => bp.bedId));

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rooms">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {dict.roomBuilder.back}
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">{roomName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)">
            <Redo2 className="h-4 w-4" />
          </Button>

          {/* Save button */}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveStatus === 'saving' || !hasUnsavedChanges}
            className="min-w-[80px]"
          >
            <Save className="mr-1 h-4 w-4" />
            {saveStatus === 'saving' ? dict.roomBuilder.saving : saveStatus === 'saved' ? dict.roomBuilder.saved : 'Save'}
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel 1: Canvas */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          <BuilderCanvas
            shapes={shapes}
            setShapes={setShapes}
            bedPlacements={bedPlacements}
            setBedPlacements={setBedPlacements}
            labels={labels}
            setLabels={setLabels}
            beds={beds}
            unit={unit}
            activeTool={activeTool}
            shapePreset={shapePreset}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            setActiveTool={setActiveTool}
          />
        </div>

        {/* Right panels */}
        <div className="flex w-80 flex-col border-l bg-background">
          {/* Panel 2: Bed List */}
          <div className="flex-1 overflow-y-auto border-b">
            <BedListPanel
              roomId={roomId}
              beds={beds}
              setBeds={setBeds}
              placedBedIds={placedBedIds}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              bedPlacements={bedPlacements}
              dict={dict}
            />
          </div>

          {/* Panel 3: Tools */}
          <div className="flex-1 overflow-y-auto">
            <ToolPanel
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              shapePreset={shapePreset}
              setShapePreset={setShapePreset}
              unit={unit}
              setUnit={setUnit}
              selectedId={selectedId}
              shapes={shapes}
              setShapes={setShapes}
              dict={dict}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
