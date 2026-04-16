'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Line } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { BedShape } from './bed-shape';
import { SplitKingConnectors } from './split-king-connector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  BASE_SCALE,
  M_TO_FT,
  BED_PRESETS,
  type LayoutShape,
  type LayoutBedPlacement,
  type LayoutLabel,
  type LayoutUnit,
  type LayoutShapeType,
} from './types';
import type { RoomBed, ActiveTool, ShapePreset } from './room-builder-shell';

interface BuilderCanvasProps {
  shapes: LayoutShape[];
  setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>>;
  bedPlacements: LayoutBedPlacement[];
  setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>>;
  labels: LayoutLabel[];
  setLabels: React.Dispatch<React.SetStateAction<LayoutLabel[]>>;
  beds: RoomBed[];
  unit: LayoutUnit;
  activeTool: ActiveTool;
  shapePreset: ShapePreset;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
}

// Grid colors
const GRID_MAJOR = '#d4d4d8';
const GRID_MINOR = '#e8e8ec';

// Shape fill colors by type
const SHAPE_FILLS: Record<LayoutShapeType, string> = {
  room: '#f5f5f4',
  bathroom: '#e0f2fe',
  deck: '#f0fdf4',
  loft: '#fef3c7',
};
const SHAPE_STROKES: Record<LayoutShapeType, string> = {
  room: '#78716c',
  bathroom: '#7dd3fc',
  deck: '#86efac',
  loft: '#fcd34d',
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BuilderCanvas({
  shapes,
  setShapes,
  bedPlacements,
  setBedPlacements,
  labels,
  setLabels,
  beds,
  unit,
  activeTool,
  shapePreset,
  selectedId,
  setSelectedId,
  setActiveTool,
}: BuilderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });

  // Drawing state for rectangle tool
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; current: LayoutShape } | null>(null);

  // Label editing modal state
  const [editingLabel, setEditingLabel] = useState<{ id: string; text: string } | null>(null);

  const scale = BASE_SCALE * zoom;

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Convert screen coords to meters
  const screenToMeters = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / scale,
      y: (sy - pan.y) / scale,
    }),
    [pan, scale],
  );

  // Zoom with scroll
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const factor = 1.08;
      const newZoom = Math.max(0.2, Math.min(5, direction > 0 ? zoom * factor : zoom / factor));

      // Zoom towards pointer
      const mouseX = pointer.x;
      const mouseY = pointer.y;
      const newPanX = mouseX - ((mouseX - pan.x) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom);
      const newPanY = mouseY - ((mouseY - pan.y) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan],
  );

  // Mouse down — start drawing or pan
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Right-click or middle-click → pan
      if (e.evt.button === 1 || e.evt.button === 2) {
        e.evt.preventDefault();
        return;
      }

      if (activeTool === 'rectangle') {
        const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
        const newShape: LayoutShape = {
          id: generateId(),
          type: shapePreset,
          x: pos.x,
          y: pos.y,
          width: 0,
          depth: 0,
          rotation: 0,
          curve: null,
        };
        setDrawing({ startX: pos.x, startY: pos.y, current: newShape });
      } else if (activeTool === 'text') {
        const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
        const newLabel: LayoutLabel = {
          id: generateId(),
          text: '',
          x: pos.x,
          y: pos.y,
          rotation: 0,
          fontSize: 14,
        };
        setLabels((prev) => [...prev, newLabel]);
        setSelectedId(newLabel.id);
        setActiveTool('select');
        // Open modal for the new label
        setEditingLabel({ id: newLabel.id, text: '' });
      } else if (activeTool === 'select') {
        // Click on empty space deselects
        const target = e.target;
        if (target === stageRef.current || (target.getClassName?.() === 'Rect' && target.attrs.name === 'grid-bg')) {
          setSelectedId(null);
        }
      }
    },
    [activeTool, shapePreset, screenToMeters, setLabels, setSelectedId, setActiveTool],
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!drawing) return;
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const x = Math.min(drawing.startX, pos.x);
      const y = Math.min(drawing.startY, pos.y);
      const width = Math.abs(pos.x - drawing.startX);
      const depth = Math.abs(pos.y - drawing.startY);
      setDrawing((prev) =>
        prev ? { ...prev, current: { ...prev.current, x, y, width, depth } } : null,
      );
    },
    [drawing, screenToMeters],
  );

  const handleMouseUp = useCallback(() => {
    if (drawing && drawing.current.width > 0.05 && drawing.current.depth > 0.05) {
      setShapes((prev) => [...prev, drawing.current]);
      setSelectedId(drawing.current.id);
      setActiveTool('select');
    }
    setDrawing(null);
  }, [drawing, setShapes, setSelectedId, setActiveTool]);

  // Pan with middle mouse drag
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        setPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    };
    const onMove = (e: MouseEvent) => {
      if (panning) {
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      }
    };
    const onUp = () => setPanning(false);

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning, pan]);

  // Delete selected with keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Don't delete if an input is focused
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
        setShapes((prev) => prev.filter((s) => s.id !== selectedId));
        setBedPlacements((prev) => prev.filter((bp) => bp.id !== selectedId));
        setLabels((prev) => prev.filter((l) => l.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setActiveTool('select');
        setDrawing(null);
      }
      // Tool shortcuts (only when not in an input)
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'r' || e.key === 'R') setActiveTool('rectangle');
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, setShapes, setBedPlacements, setLabels, setSelectedId, setActiveTool]);

  // Snap a bed position so it's fully inside the nearest room shape
  const snapBedInsideWalls = useCallback(
    (bedX: number, bedY: number, bedW: number, bedH: number): { x: number; y: number } => {
      if (shapes.length === 0) return { x: bedX, y: bedY };

      // Find the shape whose center is closest to the bed center
      const bedCX = bedX + bedW / 2;
      const bedCY = bedY + bedH / 2;
      let bestShape = shapes[0];
      let bestDist = Infinity;
      for (const shape of shapes) {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.depth / 2;
        const dist = (bedCX - cx) ** 2 + (bedCY - cy) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestShape = shape;
        }
      }

      // Clamp bed to be fully inside the best shape
      const clampedX = Math.max(bestShape.x, Math.min(bedX, bestShape.x + bestShape.width - bedW));
      const clampedY = Math.max(bestShape.y, Math.min(bedY, bestShape.y + bestShape.depth - bedH));
      return { x: clampedX, y: clampedY };
    },
    [shapes],
  );

  // Handle bed drop from palette (via custom event)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { bedId: string; bedType: string; x: number; y: number };
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      // Ignore drops outside the canvas bounds
      if (detail.x < rect.left || detail.x > rect.right || detail.y < rect.top || detail.y > rect.bottom) return;
      const pos = screenToMeters(detail.x - rect.left, detail.y - rect.top);

      const preset = BED_PRESETS.find((p) => p.type === detail.bedType);
      if (!preset) return;

      let bedX = pos.x - preset.width / 2;
      let bedY = pos.y - preset.length / 2;

      // Snap inside walls
      const snapped = snapBedInsideWalls(bedX, bedY, preset.width, preset.length);
      bedX = snapped.x;
      bedY = snapped.y;

      const placement: LayoutBedPlacement = {
        id: generateId(),
        bedId: detail.bedId,
        x: bedX,
        y: bedY,
        rotation: 0,
        splitKingPairId: null,
      };
      setBedPlacements((prev) => [...prev, placement]);
      setSelectedId(placement.id);
    };

    window.addEventListener('room-builder-drop-bed', handler);
    return () => window.removeEventListener('room-builder-drop-bed', handler);
  }, [screenToMeters, setBedPlacements, setSelectedId, snapBedInsideWalls]);

  // Render grid lines clipped to a shape's bounds
  const renderShapeGrid = (shape: LayoutShape) => {
    const lines: React.ReactNode[] = [];

    const minorStep = unit === 'meters' ? 0.1 : 0.0762;
    const majorStep = unit === 'meters' ? 1.0 : 0.3048;

    // Grid is relative to world origin, clipped to shape bounds
    const left = shape.x;
    const top = shape.y;
    const right = shape.x + shape.width;
    const bottom = shape.y + shape.depth;

    // Minor grid (only when zoomed in enough)
    if (scale * minorStep > 4) {
      const startX = Math.ceil(left / minorStep) * minorStep;
      const startY = Math.ceil(top / minorStep) * minorStep;
      for (let x = startX; x < right; x += minorStep) {
        lines.push(
          <Line
            key={`mv-${x.toFixed(4)}`}
            points={[x - left, 0, x - left, shape.depth]}
            stroke={GRID_MINOR}
            strokeWidth={0.5 / scale}
            listening={false}
          />,
        );
      }
      for (let y = startY; y < bottom; y += minorStep) {
        lines.push(
          <Line
            key={`mh-${y.toFixed(4)}`}
            points={[0, y - top, shape.width, y - top]}
            stroke={GRID_MINOR}
            strokeWidth={0.5 / scale}
            listening={false}
          />,
        );
      }
    }

    // Major grid
    const startMajX = Math.ceil(left / majorStep) * majorStep;
    const startMajY = Math.ceil(top / majorStep) * majorStep;
    for (let x = startMajX; x < right; x += majorStep) {
      lines.push(
        <Line
          key={`Mv-${x.toFixed(4)}`}
          points={[x - left, 0, x - left, shape.depth]}
          stroke={GRID_MAJOR}
          strokeWidth={1 / scale}
          listening={false}
        />,
      );
    }
    for (let y = startMajY; y < bottom; y += majorStep) {
      lines.push(
        <Line
          key={`Mh-${y.toFixed(4)}`}
          points={[0, y - top, shape.width, y - top]}
          stroke={GRID_MAJOR}
          strokeWidth={1 / scale}
          listening={false}
        />,
      );
    }

    return lines;
  };

  // Shape drag handler — moves beds inside the shape along with it
  const handleShapeDrag = (id: string, newX: number, newY: number) => {
    setShapes((prev) => {
      const old = prev.find((s) => s.id === id);
      if (!old) return prev.map((s) => (s.id === id ? { ...s, x: newX, y: newY } : s));
      const dx = newX - old.x;
      const dy = newY - old.y;

      // Move beds that were inside this shape
      if (dx !== 0 || dy !== 0) {
        setBedPlacements((bps) =>
          bps.map((bp) => {
            const bed = beds.find((b) => b.id === bp.bedId);
            const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
            if (!preset) return bp;
            // Check if bed center was inside the old shape bounds
            const bcx = bp.x + preset.width / 2;
            const bcy = bp.y + preset.length / 2;
            if (bcx >= old.x && bcx <= old.x + old.width && bcy >= old.y && bcy <= old.y + old.depth) {
              return { ...bp, x: bp.x + dx, y: bp.y + dy };
            }
            return bp;
          }),
        );
      }

      return prev.map((s) => (s.id === id ? { ...s, x: newX, y: newY } : s));
    });
  };

  // Shape resize handler (walls expand — beds stay in place)
  const handleShapeResize = (id: string, updates: Partial<LayoutShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Wall curve handler — sets the curve control point for a wall
  const handleWallCurve = (shapeId: string, wall: 'top' | 'right' | 'bottom' | 'left', controlOffset: number) => {
    setShapes((prev) => prev.map((s) => {
      if (s.id !== shapeId) return s;
      const curves = (s as LayoutShape & { wallCurves?: Record<string, number> }).wallCurves ?? {};
      return { ...s, wallCurves: { ...curves, [wall]: controlOffset } };
    }));
  };

  // Bed drag handler — snap inside walls after drag
  const handleBedDrag = (id: string, x: number, y: number) => {
    setBedPlacements((prev) => {
      const bp = prev.find((p) => p.id === id);
      if (!bp) return prev;
      const bed = beds.find((b) => b.id === bp.bedId);
      const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
      if (preset) {
        const snapped = snapBedInsideWalls(x, y, preset.width, preset.length);
        return prev.map((p) => (p.id === id ? { ...p, x: snapped.x, y: snapped.y } : p));
      }
      return prev.map((p) => (p.id === id ? { ...p, x, y } : p));
    });
  };

  // Bed rotate handler
  const handleBedRotate = (id: string, rotation: number) => {
    setBedPlacements((prev) => prev.map((bp) => (bp.id === id ? { ...bp, rotation } : bp)));
  };

  // Format dimension for display
  const fmtDim = (meters: number) => {
    if (unit === 'feet') return `${(meters * M_TO_FT).toFixed(1)}ft`;
    return `${meters.toFixed(2)}m`;
  };

  // Cursor style
  const cursor =
    activeTool === 'rectangle' ? 'crosshair' :
    activeTool === 'text' ? 'text' :
    panning ? 'grabbing' : 'default';

  // Label edit modal handlers
  const handleLabelSave = () => {
    if (!editingLabel) return;
    setLabels((prev) => prev.map((l) => (l.id === editingLabel.id ? { ...l, text: editingLabel.text } : l)));
    setEditingLabel(null);
  };

  const handleLabelCancel = () => {
    setEditingLabel(null);
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative"
      style={{ cursor }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Background (plain white, no grid) */}
        <Layer listening={false}>
          <Rect name="grid-bg" x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#ffffff" />
        </Layer>

        {/* Shapes layer — grid drawn inside each shape */}
        <Layer>
          {shapes.map((shape) => {
            const sx = shape.x * scale + pan.x;
            const sy = shape.y * scale + pan.y;
            const sw = shape.width * scale;
            const sh = shape.depth * scale;
            const isSelected = selectedId === shape.id;
            return (
            <Group key={shape.id}>
              {/* Draggable shape group — fill, grid, border, labels all move together */}
              <Group
                x={sx}
                y={sy}
                draggable={activeTool === 'select'}
                onClick={() => setSelectedId(shape.id)}
                onTap={() => setSelectedId(shape.id)}
                onDragEnd={(e) => {
                  const newX = (e.target.x() - pan.x) / scale;
                  const newY = (e.target.y() - pan.y) / scale;
                  handleShapeDrag(shape.id, newX, newY);
                  e.target.x(newX * scale + pan.x);
                  e.target.y(newY * scale + pan.y);
                }}
              >
                {/* Clipped fill + grid */}
                <Group
                  clipX={0} clipY={0}
                  clipWidth={sw} clipHeight={sh}
                  scaleX={scale} scaleY={scale}
                >
                  <Rect x={0} y={0} width={shape.width} height={shape.depth}
                    fill={SHAPE_FILLS[shape.type]} listening={false} />
                  {renderShapeGrid(shape)}
                </Group>
                {/* Border */}
                <Rect
                  x={0} y={0} width={sw} height={sh}
                  fill="transparent"
                  stroke={isSelected ? '#3b82f6' : SHAPE_STROKES[shape.type]}
                  strokeWidth={isSelected ? 2 : 1}
                  dash={shape.type === 'loft' ? [6, 4] : undefined}
                />
                {/* Type label */}
                <Text x={4} y={4}
                  text={shape.type.charAt(0).toUpperCase() + shape.type.slice(1)}
                  fontSize={10} fill="#a1a1aa" listening={false} />
                {/* Dimension label */}
                <Text x={sw - 4} y={sh - 16}
                  text={`${fmtDim(shape.width)} x ${fmtDim(shape.depth)}`}
                  fontSize={10} fill="#71717a" align="right" width={100} offsetX={100} listening={false} />
              </Group>

              {/* Resize handles + arc handles — positioned absolutely (not inside draggable group) */}
              {isSelected && (
                <>
                  {/* === 4 CORNER handles === */}
                  {/* Top-left */}
                  <Rect x={sx - 4} y={sy - 4} width={8} height={8} fill="#3b82f6" cornerRadius={1}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'nwse-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable
                    onDragEnd={(e) => {
                      const newX = (e.target.x() + 4 - pan.x) / scale;
                      const newY = (e.target.y() + 4 - pan.y) / scale;
                      const newW = Math.max(0.1, shape.x + shape.width - newX);
                      const newD = Math.max(0.1, shape.y + shape.depth - newY);
                      handleShapeResize(shape.id, { x: newX, y: newY, width: newW, depth: newD });
                      e.target.x(newX * scale + pan.x - 4);
                      e.target.y(newY * scale + pan.y - 4);
                    }}
                  />
                  {/* Top-right */}
                  <Rect x={sx + sw - 4} y={sy - 4} width={8} height={8} fill="#3b82f6" cornerRadius={1}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'nesw-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable
                    onDragEnd={(e) => {
                      const newW = Math.max(0.1, (e.target.x() + 4 - pan.x) / scale - shape.x);
                      const newY = (e.target.y() + 4 - pan.y) / scale;
                      const newD = Math.max(0.1, shape.y + shape.depth - newY);
                      handleShapeResize(shape.id, { y: newY, width: newW, depth: newD });
                      e.target.x(shape.x * scale + pan.x + newW * scale - 4);
                      e.target.y(newY * scale + pan.y - 4);
                    }}
                  />
                  {/* Bottom-left */}
                  <Rect x={sx - 4} y={sy + sh - 4} width={8} height={8} fill="#3b82f6" cornerRadius={1}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'nesw-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable
                    onDragEnd={(e) => {
                      const newX = (e.target.x() + 4 - pan.x) / scale;
                      const newW = Math.max(0.1, shape.x + shape.width - newX);
                      const newD = Math.max(0.1, (e.target.y() + 4 - pan.y) / scale - shape.y);
                      handleShapeResize(shape.id, { x: newX, width: newW, depth: newD });
                      e.target.x(newX * scale + pan.x - 4);
                      e.target.y(shape.y * scale + pan.y + newD * scale - 4);
                    }}
                  />
                  {/* Bottom-right */}
                  <Rect x={sx + sw - 4} y={sy + sh - 4} width={8} height={8} fill="#3b82f6" cornerRadius={1}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'nwse-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable
                    onDragEnd={(e) => {
                      const newW = Math.max(0.1, (e.target.x() + 4 - pan.x) / scale - shape.x);
                      const newD = Math.max(0.1, (e.target.y() + 4 - pan.y) / scale - shape.y);
                      handleShapeResize(shape.id, { width: newW, depth: newD });
                      e.target.x(shape.x * scale + pan.x + newW * scale - 4);
                      e.target.y(shape.y * scale + pan.y + newD * scale - 4);
                    }}
                  />

                  {/* === 4 EDGE handles (wall drag) === */}
                  {/* Right edge */}
                  <Rect x={sx + sw - 3} y={sy + sh * 0.25} width={6} height={sh * 0.5} fill="transparent"
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ew-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: pos.x, y: sy + sh * 0.25 })}
                    onDragEnd={(e) => {
                      const newW = Math.max(0.1, (e.target.x() + 3 - pan.x) / scale - shape.x);
                      handleShapeResize(shape.id, { width: newW });
                      e.target.x(shape.x * scale + pan.x + newW * scale - 3);
                    }}
                  />
                  {/* Left edge */}
                  <Rect x={sx - 3} y={sy + sh * 0.25} width={6} height={sh * 0.5} fill="transparent"
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ew-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: pos.x, y: sy + sh * 0.25 })}
                    onDragEnd={(e) => {
                      const newX = (e.target.x() + 3 - pan.x) / scale;
                      const newW = Math.max(0.1, shape.x + shape.width - newX);
                      handleShapeResize(shape.id, { x: newX, width: newW });
                      e.target.x(newX * scale + pan.x - 3);
                    }}
                  />
                  {/* Bottom edge */}
                  <Rect x={sx + sw * 0.25} y={sy + sh - 3} width={sw * 0.5} height={6} fill="transparent"
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ns-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: sx + sw * 0.25, y: pos.y })}
                    onDragEnd={(e) => {
                      const newD = Math.max(0.1, (e.target.y() + 3 - pan.y) / scale - shape.y);
                      handleShapeResize(shape.id, { depth: newD });
                      e.target.y(shape.y * scale + pan.y + newD * scale - 3);
                    }}
                  />
                  {/* Top edge */}
                  <Rect x={sx + sw * 0.25} y={sy - 3} width={sw * 0.5} height={6} fill="transparent"
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ns-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: sx + sw * 0.25, y: pos.y })}
                    onDragEnd={(e) => {
                      const newY = (e.target.y() + 3 - pan.y) / scale;
                      const newD = Math.max(0.1, shape.y + shape.depth - newY);
                      handleShapeResize(shape.id, { y: newY, depth: newD });
                      e.target.y(newY * scale + pan.y - 3);
                    }}
                  />

                  {/* === 4 WALL ARC handles (blue circles at wall centers) === */}
                  <Rect x={sx + sw / 2 - 5} y={sy - 5} width={10} height={10}
                    fill="#3b82f6" cornerRadius={5} opacity={0.6}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ns-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: sx + sw / 2 - 5, y: pos.y })}
                    onDragEnd={(e) => {
                      const offset = (sy - e.target.y() - 5) / scale;
                      handleWallCurve(shape.id, 'top', offset);
                      e.target.y(sy - 5);
                    }}
                  />
                  <Rect x={sx + sw / 2 - 5} y={sy + sh - 5} width={10} height={10}
                    fill="#3b82f6" cornerRadius={5} opacity={0.6}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ns-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: sx + sw / 2 - 5, y: pos.y })}
                    onDragEnd={(e) => {
                      const offset = (e.target.y() + 5 - (sy + sh)) / scale;
                      handleWallCurve(shape.id, 'bottom', offset);
                      e.target.y(sy + sh - 5);
                    }}
                  />
                  <Rect x={sx - 5} y={sy + sh / 2 - 5} width={10} height={10}
                    fill="#3b82f6" cornerRadius={5} opacity={0.6}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ew-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: pos.x, y: sy + sh / 2 - 5 })}
                    onDragEnd={(e) => {
                      const offset = (sx - e.target.x() - 5) / scale;
                      handleWallCurve(shape.id, 'left', offset);
                      e.target.x(sx - 5);
                    }}
                  />
                  <Rect x={sx + sw - 5} y={sy + sh / 2 - 5} width={10} height={10}
                    fill="#3b82f6" cornerRadius={5} opacity={0.6}
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ew-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable dragBoundFunc={(pos) => ({ x: pos.x, y: sy + sh / 2 - 5 })}
                    onDragEnd={(e) => {
                      const offset = (e.target.x() + 5 - (sx + sw)) / scale;
                      handleWallCurve(shape.id, 'right', offset);
                      e.target.x(sx + sw - 5);
                    }}
                  />
                </>
              )}
            </Group>
            );
          })}

          {/* Drawing preview */}
          {drawing && (
            <Group>
              <Rect
                x={drawing.current.x * scale + pan.x}
                y={drawing.current.y * scale + pan.y}
                width={drawing.current.width * scale}
                height={drawing.current.depth * scale}
                fill={SHAPE_FILLS[drawing.current.type]}
                stroke="#3b82f6"
                strokeWidth={2}
                dash={[6, 3]}
                listening={false}
              />
              <Text
                x={drawing.current.x * scale + pan.x + drawing.current.width * scale + 6}
                y={drawing.current.y * scale + pan.y + drawing.current.depth * scale - 14}
                text={`${fmtDim(drawing.current.width)} x ${fmtDim(drawing.current.depth)}`}
                fontSize={12}
                fill="#3b82f6"
                fontStyle="bold"
                listening={false}
              />
            </Group>
          )}
        </Layer>

        {/* Beds layer */}
        <Layer>
          {bedPlacements.map((bp) => {
            const bed = beds.find((b) => b.id === bp.bedId);
            if (!bed) return null;
            return (
              <BedShape
                key={bp.id}
                placement={bp}
                bed={bed}
                scale={scale}
                panX={pan.x}
                panY={pan.y}
                isSelected={selectedId === bp.id}
                onSelect={() => setSelectedId(bp.id)}
                onDragEnd={(x, y) => handleBedDrag(bp.id, x, y)}
                onRotate={(r) => handleBedRotate(bp.id, r)}
                draggable={activeTool === 'select'}
              />
            );
          })}
          <SplitKingConnectors
            placements={bedPlacements}
            beds={beds}
            scale={scale}
            panX={pan.x}
            panY={pan.y}
            onTogglePair={(idA, idB) => {
              setBedPlacements((prev) => {
                const a = prev.find((p) => p.id === idA);
                const b = prev.find((p) => p.id === idB);
                if (!a || !b) return prev;
                const isPaired = a.splitKingPairId === idB;
                if (isPaired) {
                  // Unpair
                  return prev.map((p) => {
                    if (p.id === idA) return { ...p, splitKingPairId: null };
                    if (p.id === idB) return { ...p, splitKingPairId: null };
                    return p;
                  });
                } else {
                  // Pair — snap beds together
                  const preset = BED_PRESETS.find((p) => p.type === 'single_long');
                  if (!preset) return prev;
                  const leftId = a.x <= b.x ? idA : idB;
                  const rightId = a.x <= b.x ? idB : idA;
                  const left = a.x <= b.x ? a : b;
                  return prev.map((p) => {
                    if (p.id === leftId) return { ...p, splitKingPairId: rightId };
                    if (p.id === rightId) return { ...p, splitKingPairId: leftId, x: left.x + preset.width, y: left.y };
                    return p;
                  });
                }
              });
            }}
          />
        </Layer>

        {/* Labels layer */}
        <Layer>
          {labels.map((label) => (
            <Text
              key={label.id}
              x={label.x * scale + pan.x}
              y={label.y * scale + pan.y}
              text={label.text || 'Add text...'}
              fontSize={label.fontSize}
              fill={label.text ? '#44403c' : '#d4d4d8'}
              fontStyle={label.text ? 'normal' : 'italic'}
              draggable={activeTool === 'select'}
              onClick={() => {
                setSelectedId(label.id);
                setEditingLabel({ id: label.id, text: label.text });
              }}
              onDragEnd={(e) => {
                const newX = (e.target.x() - pan.x) / scale;
                const newY = (e.target.y() - pan.y) / scale;
                setLabels((prev) => prev.map((l) => (l.id === label.id ? { ...l, x: newX, y: newY } : l)));
                e.target.x(newX * scale + pan.x);
                e.target.y(newY * scale + pan.y);
              }}
            />
          ))}
        </Layer>
      </Stage>

      {/* Label editing modal */}
      <Dialog open={!!editingLabel} onOpenChange={(open) => { if (!open) handleLabelCancel(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Enter label text..."
            value={editingLabel?.text ?? ''}
            onChange={(e) => setEditingLabel((prev) => prev ? { ...prev, text: e.target.value } : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelSave();
              if (e.key === 'Escape') handleLabelCancel();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleLabelCancel}>Cancel</Button>
            <Button onClick={handleLabelSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
