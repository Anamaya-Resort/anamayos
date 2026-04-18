'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MousePointer2, Square, Circle, Type } from 'lucide-react';
import { M_TO_FT, FT_TO_M, FURNITURE_PRESETS, type LayoutShape, type LayoutUnit } from './types';
import type { ActiveTool, ShapePreset, GeometryPreset, FurniturePresetType } from './room-builder-shell';
import type { TranslationKeys } from '@/i18n/en';

interface ToolPanelProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  shapePreset: ShapePreset;
  setShapePreset: (preset: ShapePreset) => void;
  geometryPreset: GeometryPreset;
  setGeometryPreset: (preset: GeometryPreset) => void;
  furniturePreset: FurniturePresetType;
  setFurniturePreset: (preset: FurniturePresetType) => void;
  unit: LayoutUnit;
  setUnit: (unit: LayoutUnit) => void;
  selectedId: string | null;
  shapes: LayoutShape[];
  setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>>;
  dict: TranslationKeys;
}

const GEOMETRY_PRESETS: { key: GeometryPreset; label: string; icon: React.ReactNode }[] = [
  { key: 'rectangle', label: 'Rectangle', icon: <Square className="h-3.5 w-3.5" /> },
  { key: 'circle', label: 'Circle', icon: <Circle className="h-3.5 w-3.5" /> },
  {
    key: 'semicircle', label: 'Semi-C', icon: (
      <svg width={14} height={14} viewBox="0 0 14 14">
        <path d="M 2 11 A 5 5 0 0 1 12 11 Z" fill="none" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    ),
  },
];

const ROOM_TYPE_PRESETS: { key: ShapePreset; icon: string }[] = [
  { key: 'bathroom', icon: '🚿' },
  { key: 'loft', icon: '⬆' },
  { key: 'deck', icon: '🌿' },
];

export function ToolPanel({
  activeTool, setActiveTool, shapePreset, setShapePreset,
  geometryPreset, setGeometryPreset,
  furniturePreset, setFurniturePreset,
  unit, setUnit, selectedId, shapes, setShapes, dict,
}: ToolPanelProps) {
  const rb = dict.roomBuilder;
  const selectedShape = shapes.find((s) => s.id === selectedId);
  const [dimInput, setDimInput] = useState('');

  const applyDimensions = () => {
    if (!selectedShape || !dimInput.trim()) return;
    const parts = dimInput.split(/[,x×]/).map((s) => parseFloat(s.trim()));
    if (parts.length < 2 || parts.some(isNaN) || parts.some((v) => v <= 0)) return;
    let [w, d] = parts;
    if (unit === 'feet') { w *= FT_TO_M; d *= FT_TO_M; }
    setShapes((prev) => prev.map((s) => (s.id === selectedShape.id ? { ...s, width: w, depth: d } : s)));
    setDimInput('');
  };

  const fmtVal = (meters: number) => unit === 'feet' ? (meters * M_TO_FT).toFixed(1) : meters.toFixed(2);

  return (
    <div className="p-3 space-y-4">
      {/* Tools row */}
      <div>
        <h3 className="text-sm font-semibold mb-2">{rb.tools}</h3>
        <div className="flex gap-1 flex-wrap">
          <Button variant={activeTool === 'select' ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveTool('select')} title="Select (V)">
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button variant={activeTool === 'text' ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveTool('text')} title="Text (T)">
            <Type className="h-4 w-4" />
          </Button>
          <Button variant={activeTool === 'door' ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveTool('door')} title="Door (draw on wall)" className="gap-1">
            <svg width={14} height={14} viewBox="0 0 14 14"><rect x={1} y={3} width={12} height={8} rx={1} fill="none" stroke="currentColor" strokeWidth={1.5} /><line x1={5} y1={3} x2={5} y2={11} stroke="currentColor" strokeWidth={1.5} /></svg>
            <span className="text-[9px]">Door</span>
          </Button>
          <Button variant={activeTool === 'window' ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveTool('window')} title="Window (draw on wall)" className="gap-1">
            <svg width={14} height={14} viewBox="0 0 14 14"><rect x={1} y={4} width={12} height={6} rx={0.5} fill="#9bb2c6" stroke="currentColor" strokeWidth={1} /><line x1={7} y1={4} x2={7} y2={10} stroke="currentColor" strokeWidth={0.5} /></svg>
            <span className="text-[9px]">Window</span>
          </Button>
          <Button variant={activeTool === 'arrow' ? 'default' : 'outline'} size="sm"
            onClick={() => setActiveTool('arrow')} title="Arrow" className="gap-1">
            <svg width={14} height={14} viewBox="0 0 14 14"><line x1={2} y1={12} x2={12} y2={2} stroke="currentColor" strokeWidth={2} strokeLinecap="round" /><polyline points="7,2 12,2 12,7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-[9px]">Arrow</span>
          </Button>
        </div>
      </div>

      {/* Rooms section */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Rooms (click + drag)</h4>
        {/* Row 1: Geometry shapes */}
        <div className="flex gap-1 flex-wrap mb-1.5">
          {GEOMETRY_PRESETS.map(({ key, label, icon }) => (
            <Button key={key}
              variant={activeTool === 'rectangle' && geometryPreset === key && shapePreset === 'room' ? 'default' : 'outline'} size="sm"
              onClick={() => { setGeometryPreset(key); setShapePreset('room'); setActiveTool('rectangle'); }}
              className="text-xs gap-1">
              {icon}{label}
            </Button>
          ))}
        </div>
        {/* Row 2: Room types (always rectangle geometry) */}
        <div className="flex gap-1 flex-wrap">
          {ROOM_TYPE_PRESETS.map(({ key, icon }) => (
            <Button key={key}
              variant={activeTool === 'rectangle' && shapePreset === key ? 'default' : 'outline'} size="sm"
              onClick={() => { setShapePreset(key); setGeometryPreset('rectangle'); setActiveTool('rectangle'); }}
              className="text-xs">
              <span className="mr-1">{icon}</span>{rb[key]}
            </Button>
          ))}
        </div>
      </div>

      {/* Shapes row — always visible */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Shapes (click + drag)</h4>
        <div className="flex gap-1 flex-wrap">
          {FURNITURE_PRESETS.map((fp) => (
            <Button key={fp.type}
              variant={activeTool === 'furniture' && furniturePreset === fp.type ? 'default' : 'outline'} size="sm"
              onClick={() => { setFurniturePreset(fp.type as FurniturePresetType); setActiveTool('furniture'); }}
              className="text-xs gap-1">
              <svg width={12} height={12} viewBox="0 0 12 12">
                {fp.shape === 'circle' ? (
                  <circle cx={6} cy={6} r={5} fill="none" stroke="currentColor" strokeWidth={1.5} />
                ) : fp.shape === 'semicircle' ? (
                  <path d="M 1 10 A 5 5 0 0 1 11 10 Z" fill="none" stroke="currentColor" strokeWidth={1.5} />
                ) : (
                  <rect x={0.5} y={2} width={11} height={8} rx={1} fill="none" stroke="currentColor" strokeWidth={1.5} />
                )}
              </svg>
              {fp.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Unit toggle */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{rb.units}</h4>
        <div className="flex gap-1">
          <Button variant={unit === 'meters' ? 'default' : 'outline'} size="sm"
            onClick={() => setUnit('meters')} className="text-xs flex-1">{rb.meters}</Button>
          <Button variant={unit === 'feet' ? 'default' : 'outline'} size="sm"
            onClick={() => setUnit('feet')} className="text-xs flex-1">{rb.feet}</Button>
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
              <input type="text" placeholder="w, d (e.g., 6, 4.5)" value={dimInput}
                onChange={(e) => setDimInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyDimensions()}
                className="flex-1 rounded border px-2 py-1 text-xs font-mono" />
              <Button size="sm" variant="outline" onClick={applyDimensions} className="text-xs">Set</Button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts */}
      <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2 border-t">
        <p><kbd className="font-mono bg-muted px-1 rounded">V</kbd> Select</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">T</kbd> Text</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Del</kbd> Delete selected</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Cmd+Z</kbd> Undo</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Cmd+Shift+Z</kbd> Redo</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Cmd+S</kbd> Save</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Dbl-click</kbd> Rotate bed / Resize furniture</p>
        <p><kbd className="font-mono bg-muted px-1 rounded">Right-click</kbd> Edit furniture dimensions</p>
        <p>Drag background to pan, scroll to zoom</p>
      </div>
    </div>
  );
}
