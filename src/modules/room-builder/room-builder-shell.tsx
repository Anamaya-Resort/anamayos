'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  // Auto-save on layout changes (debounced)
  const save = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const layoutJson: LayoutJson = { shapes, beds: bedPlacements, labels };
      await fetch(`/api/admin/rooms/${roomId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layoutJson, unit }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, [shapes, bedPlacements, labels, unit, roomId]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(save, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [save]);

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
        <span className="text-xs text-muted-foreground">
          {saveStatus === 'saving' && dict.roomBuilder.saving}
          {saveStatus === 'saved' && dict.roomBuilder.saved}
        </span>
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
