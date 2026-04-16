'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MousePointer2, Square, Type } from 'lucide-react';
import { M_TO_FT, FT_TO_M, type LayoutShape, type LayoutUnit } from './types';
import type { ActiveTool, ShapePreset } from './room-builder-shell';
import type { TranslationKeys } from '@/i18n/en';

interface ToolPanelProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  shapePreset: ShapePreset;
  setShapePreset: (preset: ShapePreset) => void;
  unit: LayoutUnit;
  setUnit: (unit: LayoutUnit) => void;
  selectedId: string | null;
  shapes: LayoutShape[];
  setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>>;
  dict: TranslationKeys;
}

const SHAPE_PRESETS: { key: ShapePreset; icon: string }[] = [
  { key: 'room', icon: '🏠' },
  { key: 'bathroom', icon: '🚿' },
  { key: 'deck', icon: '🌿' },
  { key: 'loft', icon: '⬆' },
];

export function ToolPanel({
  activeTool,
  setActiveTool,
  shapePreset,
  setShapePreset,
  unit,
  setUnit,
  selectedId,
  shapes,
  setShapes,
  dict,
}: ToolPanelProps) {
  const rb = dict.roomBuilder;
  const selectedShape = shapes.find((s) => s.id === selectedId);

  // Dimension inputs for selected shape
  const [dimInput, setDimInput] = useState('');

  const applyDimensions = () => {
    if (!selectedShape || !dimInput.trim()) return;
    const parts = dimInput.split(/[,x×]/).map((s) => parseFloat(s.trim()));
    if (parts.length < 2 || parts.some(isNaN) || parts.some((v) => v <= 0)) return;

    let [w, d] = parts;
    // Convert from display unit to meters if needed
    if (unit === 'feet') {
      w *= FT_TO_M;
      d *= FT_TO_M;
    }

    setShapes((prev) =>
      prev.map((s) => (s.id === selectedShape.id ? { ...s, width: w, depth: d } : s)),
    );
    setDimInput('');
  };

  const fmtVal = (meters: number) => {
    if (unit === 'feet') return (meters * M_TO_FT).toFixed(1);
    return meters.toFixed(2);
  };

  return (
    <div className="p-3 space-y-4">
      {/* Tool selection */}
      <div>
        <h3 className="text-sm font-semibold mb-2">{rb.tools}</h3>
        <div className="flex gap-1">
          <Button
            variant={activeTool === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool('select')}
            title="Select (V)"
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === 'rectangle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool('rectangle')}
            title="Rectangle (R)"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant={activeTool === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool('text')}
            title="Text (T)"
          >
            <Type className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Shape presets — shown when rectangle tool is active */}
      {activeTool === 'rectangle' && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{rb.shapes}</h4>
          <div className="flex gap-1 flex-wrap">
            {SHAPE_PRESETS.map(({ key, icon }) => (
              <Button
                key={key}
                variant={shapePreset === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShapePreset(key)}
                className="text-xs"
              >
                <span className="mr-1">{icon}</span>
                {rb[key]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Unit toggle */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{rb.units}</h4>
        <div className="flex gap-1">
          <Button
            variant={unit === 'meters' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUnit('meters')}
            className="text-xs flex-1"
          >
            {rb.meters}
          </Button>
          <Button
            variant={unit === 'feet' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUnit('feet')}
            className="text-xs flex-1"
          >
            {rb.feet}
          </Button>
        </div>
      </div>

      {/* Selected shape dimensions */}
      {selectedShape && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{rb.dimensions}</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-10">{rb.width}:</span>
              <span className="font-mono">{fmtVal(selectedShape.width)} {unit === 'feet' ? 'ft' : 'm'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-10">{rb.depth}:</span>
              <span className="font-mono">{fmtVal(selectedShape.depth)} {unit === 'feet' ? 'ft' : 'm'}</span>
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="w, d (e.g., 6, 4.5)"
                value={dimInput}
                onChange={(e) => setDimInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyDimensions()}
                className="flex-1 rounded border px-2 py-1 text-xs font-mono"
              />
              <Button size="sm" variant="outline" onClick={applyDimensions} className="text-xs">
                Set
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts */}
      <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2 border-t">
        <p><kbd className="font-mono bg-muted px-1 rounded">V</kbd> Select</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">R</kbd> Rectangle</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">T</kbd> Text</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Del</kbd> Delete selected</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> Deselect</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Dbl-click</kbd> Rotate bed 45°</p>
        <p>Middle-mouse drag to pan, scroll to zoom</p>
      </div>
    </div>
  );
}
