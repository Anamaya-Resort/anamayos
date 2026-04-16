'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Line, Circle } from 'react-konva';
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

const GRID_MAJOR = '#d4d4d8';
const GRID_MINOR = '#e8e8ec';

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
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; current: LayoutShape } | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ id: string; text: string } | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  const scale = BASE_SCALE * zoom;

  // ── Resize observer ──
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

  const screenToMeters = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / scale,
      y: (sy - pan.y) / scale,
    }),
    [pan, scale],
  );

  // ── Zoom ──
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;
      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const factor = 1.08;
      const newZoom = Math.max(0.2, Math.min(5, direction > 0 ? zoom * factor : zoom / factor));
      const mouseX = pointer.x;
      const mouseY = pointer.y;
      const newPanX = mouseX - ((mouseX - pan.x) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom);
      const newPanY = mouseY - ((mouseY - pan.y) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom);
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan],
  );

  // ── Mouse down (draw / text / deselect) ──
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (e.evt.button === 1 || e.evt.button === 2) { e.evt.preventDefault(); return; }
      if (activeTool === 'rectangle') {
        const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
        setDrawing({
          startX: pos.x, startY: pos.y,
          current: { id: generateId(), type: shapePreset, x: pos.x, y: pos.y, width: 0, depth: 0, rotation: 0, curve: null },
        });
      } else if (activeTool === 'text') {
        const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
        const newLabel: LayoutLabel = { id: generateId(), text: '', x: pos.x, y: pos.y, rotation: 0, fontSize: 14 };
        setLabels((prev) => [...prev, newLabel]);
        setSelectedId(newLabel.id);
        setActiveTool('select');
        setEditingLabel({ id: newLabel.id, text: '' });
      } else if (activeTool === 'select') {
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
      setDrawing((prev) =>
        prev ? { ...prev, current: { ...prev.current, x, y, width: Math.abs(pos.x - drawing.startX), depth: Math.abs(pos.y - drawing.startY) } } : null,
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

  // ── Pan (middle mouse) ──
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      if (e.button === 1) { e.preventDefault(); setPanning(true); panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }
    };
    const onMove = (e: MouseEvent) => { if (panning) setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); };
    const onUp = () => setPanning(false);
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [panning, pan]);

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setShapes((prev) => prev.filter((s) => s.id !== selectedId));
        setBedPlacements((prev) => prev.filter((bp) => bp.id !== selectedId));
        setLabels((prev) => prev.filter((l) => l.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'Escape') { setSelectedId(null); setActiveTool('select'); setDrawing(null); }
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'r' || e.key === 'R') setActiveTool('rectangle');
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, setShapes, setBedPlacements, setLabels, setSelectedId, setActiveTool]);

  // ── Snap bed inside walls ──
  const snapBedInsideWalls = useCallback(
    (bedX: number, bedY: number, bedW: number, bedH: number): { x: number; y: number } => {
      if (shapes.length === 0) return { x: bedX, y: bedY };
      let bestX = bedX, bestY = bedY, bestDist = Infinity;
      for (const shape of shapes) {
        if (shape.width < bedW || shape.depth < bedH) continue;
        const cx = Math.max(shape.x, Math.min(bedX, shape.x + shape.width - bedW));
        const cy = Math.max(shape.y, Math.min(bedY, shape.y + shape.depth - bedH));
        const d = (cx - bedX) ** 2 + (cy - bedY) ** 2;
        if (d < bestDist) { bestDist = d; bestX = cx; bestY = cy; }
      }
      if (bestDist === Infinity && shapes.length > 0) {
        const s = shapes[0];
        bestX = Math.max(s.x, Math.min(bedX, s.x + s.width - bedW));
        bestY = Math.max(s.y, Math.min(bedY, s.y + s.depth - bedH));
      }
      return { x: bestX, y: bestY };
    },
    [shapes],
  );

  // ── Bed constrain during drag (live snap) ──
  const handleBedDragMove = useCallback(
    (e: KonvaEventObject<DragEvent>, bedId: string) => {
      const bed = beds.find((b) => b.id === bedId);
      const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
      if (!preset) return;
      const rawX = (e.target.x() - pan.x) / scale;
      const rawY = (e.target.y() - pan.y) / scale;
      const snapped = snapBedInsideWalls(rawX, rawY, preset.width, preset.length);
      e.target.x(snapped.x * scale + pan.x);
      e.target.y(snapped.y * scale + pan.y);
    },
    [beds, pan, scale, snapBedInsideWalls],
  );

  // ── Bed drop from palette ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { bedId: string; bedType: string; x: number; y: number };
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      if (detail.x < rect.left || detail.x > rect.right || detail.y < rect.top || detail.y > rect.bottom) return;
      const pos = screenToMeters(detail.x - rect.left, detail.y - rect.top);
      const preset = BED_PRESETS.find((p) => p.type === detail.bedType);
      if (!preset) return;
      const snapped = snapBedInsideWalls(pos.x - preset.width / 2, pos.y - preset.length / 2, preset.width, preset.length);
      const placement: LayoutBedPlacement = { id: generateId(), bedId: detail.bedId, x: snapped.x, y: snapped.y, rotation: 0, splitKingPairId: null };
      setBedPlacements((prev) => [...prev, placement]);
      setSelectedId(placement.id);
    };
    window.addEventListener('room-builder-drop-bed', handler);
    return () => window.removeEventListener('room-builder-drop-bed', handler);
  }, [screenToMeters, setBedPlacements, setSelectedId, snapBedInsideWalls]);

  // ── Grid inside a shape ──
  const renderShapeGrid = (shape: LayoutShape) => {
    const lines: React.ReactNode[] = [];
    const minorStep = unit === 'meters' ? 0.1 : 0.0762;
    const majorStep = unit === 'meters' ? 1.0 : 0.3048;
    const left = shape.x, top = shape.y, right = shape.x + shape.width, bottom = shape.y + shape.depth;

    if (scale * minorStep > 4) {
      for (let x = Math.ceil(left / minorStep) * minorStep; x < right; x += minorStep)
        lines.push(<Line key={`mv-${x.toFixed(4)}`} points={[x - left, 0, x - left, shape.depth]} stroke={GRID_MINOR} strokeWidth={0.5 / scale} listening={false} />);
      for (let y = Math.ceil(top / minorStep) * minorStep; y < bottom; y += minorStep)
        lines.push(<Line key={`mh-${y.toFixed(4)}`} points={[0, y - top, shape.width, y - top]} stroke={GRID_MINOR} strokeWidth={0.5 / scale} listening={false} />);
    }
    for (let x = Math.ceil(left / majorStep) * majorStep; x < right; x += majorStep)
      lines.push(<Line key={`Mv-${x.toFixed(4)}`} points={[x - left, 0, x - left, shape.depth]} stroke={GRID_MAJOR} strokeWidth={1 / scale} listening={false} />);
    for (let y = Math.ceil(top / majorStep) * majorStep; y < bottom; y += majorStep)
      lines.push(<Line key={`Mh-${y.toFixed(4)}`} points={[0, y - top, shape.width, y - top]} stroke={GRID_MAJOR} strokeWidth={1 / scale} listening={false} />);
    return lines;
  };

  // ── Build border points with optional wall arcs ──
  const buildBorderPoints = (shape: LayoutShape, sw: number, sh: number): number[] => {
    const curves = shape.wallCurves ?? {};
    const topArc = (curves.top ?? 0) * scale;
    const bottomArc = (curves.bottom ?? 0) * scale;
    const leftArc = (curves.left ?? 0) * scale;
    const rightArc = (curves.right ?? 0) * scale;

    // Build as a series of points. For arcs, add a midpoint offset.
    // Konva Line with tension=0 draws straight segments; we use bezierPoints for arcs.
    // Simpler approach: use sceneFunc on a Shape, or just add midpoints.
    // We'll use a polyline with extra midpoints for curves.
    const pts: number[] = [];
    // Top wall: left to right
    pts.push(0, 0);
    if (topArc !== 0) pts.push(sw / 2, -topArc);
    pts.push(sw, 0);
    // Right wall: top to bottom
    if (rightArc !== 0) pts.push(sw + rightArc, sh / 2);
    pts.push(sw, sh);
    // Bottom wall: right to left
    if (bottomArc !== 0) pts.push(sw / 2, sh + bottomArc);
    pts.push(0, sh);
    // Left wall: bottom to top
    if (leftArc !== 0) pts.push(-leftArc, sh / 2);

    return pts;
  };

  // ── Shape handlers ──
  const handleShapeDrag = (id: string, newX: number, newY: number) => {
    const old = shapes.find((s) => s.id === id);
    const dx = old ? newX - old.x : 0;
    const dy = old ? newY - old.y : 0;
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, x: newX, y: newY } : s)));
    if (old && (dx !== 0 || dy !== 0)) {
      setBedPlacements((bps) =>
        bps.map((bp) => {
          const bed = beds.find((b) => b.id === bp.bedId);
          const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
          if (!preset) return bp;
          const bcx = bp.x + preset.width / 2, bcy = bp.y + preset.length / 2;
          if (bcx >= old.x && bcx <= old.x + old.width && bcy >= old.y && bcy <= old.y + old.depth)
            return { ...bp, x: bp.x + dx, y: bp.y + dy };
          return bp;
        }),
      );
    }
  };

  const handleShapeResize = (id: string, updates: Partial<LayoutShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleWallCurve = (shapeId: string, wall: string, offset: number) => {
    setShapes((prev) => prev.map((s) => {
      if (s.id !== shapeId) return s;
      const curves = s.wallCurves ?? {};
      return { ...s, wallCurves: { ...curves, [wall]: offset } };
    }));
  };

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

  const handleBedRotate = (id: string, rotation: number) => {
    setBedPlacements((prev) => prev.map((bp) => (bp.id === id ? { ...bp, rotation } : bp)));
  };

  const fmtDim = (meters: number) => unit === 'feet' ? `${(meters * M_TO_FT).toFixed(1)}ft` : `${meters.toFixed(2)}m`;
  const cursor = activeTool === 'rectangle' ? 'crosshair' : activeTool === 'text' ? 'text' : panning ? 'grabbing' : 'default';

  const handleLabelSave = () => {
    if (!editingLabel) return;
    setLabels((prev) => prev.map((l) => (l.id === editingLabel.id ? { ...l, text: editingLabel.text } : l)));
    setEditingLabel(null);
  };
  const handleLabelCancel = () => setEditingLabel(null);

  // ── Helper: live resize from a handle's onDragMove ──
  const resizeFromHandle = (shapeId: string, e: KonvaEventObject<DragEvent>, compute: (hx: number, hy: number) => Partial<LayoutShape>) => {
    const hx = e.target.x();
    const hy = e.target.y();
    const updates = compute(hx, hy);
    handleShapeResize(shapeId, updates);
  };

  return (
    <div ref={containerRef} className="h-full w-full relative" style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
      <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

        {/* Background */}
        <Layer listening={false}>
          <Rect name="grid-bg" x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#ffffff" />
        </Layer>

        {/* Shapes */}
        <Layer>
          {shapes.map((shape) => {
            const sx = shape.x * scale + pan.x;
            const sy = shape.y * scale + pan.y;
            const sw = shape.width * scale;
            const sh = shape.depth * scale;
            const isSelected = selectedId === shape.id;
            const showHandles = isSelected || hoveredShapeId === shape.id;
            const hasCurves = Object.values(shape.wallCurves ?? {}).some((v) => v !== 0);

            return (
              <Group key={shape.id}>
                {/* Draggable shape — fill, grid, border, labels move together */}
                <Group
                  x={sx} y={sy}
                  draggable={activeTool === 'select'}
                  onClick={() => setSelectedId(shape.id)}
                  onTap={() => setSelectedId(shape.id)}
                  onMouseEnter={() => setHoveredShapeId(shape.id)}
                  onMouseLeave={() => setHoveredShapeId((prev) => prev === shape.id ? null : prev)}
                  onDragEnd={(e) => {
                    const newX = (e.target.x() - pan.x) / scale;
                    const newY = (e.target.y() - pan.y) / scale;
                    handleShapeDrag(shape.id, newX, newY);
                    e.target.x(newX * scale + pan.x);
                    e.target.y(newY * scale + pan.y);
                  }}
                >
                  {/* Clipped fill + grid */}
                  <Group clipX={0} clipY={0} clipWidth={sw} clipHeight={sh} scaleX={scale} scaleY={scale}>
                    <Rect x={0} y={0} width={shape.width} height={shape.depth} fill={SHAPE_FILLS[shape.type]} listening={false} />
                    {renderShapeGrid(shape)}
                  </Group>
                  {/* Border — use Line for curves, Rect for straight */}
                  {hasCurves ? (
                    <Line
                      points={buildBorderPoints(shape, sw, sh)}
                      closed tension={0.3}
                      stroke={isSelected ? '#3b82f6' : SHAPE_STROKES[shape.type]}
                      strokeWidth={isSelected ? 2 : 1}
                      dash={shape.type === 'loft' ? [6, 4] : undefined}
                      listening={false}
                    />
                  ) : (
                    <Rect x={0} y={0} width={sw} height={sh} fill="transparent"
                      stroke={isSelected ? '#3b82f6' : SHAPE_STROKES[shape.type]}
                      strokeWidth={isSelected ? 2 : 1}
                      dash={shape.type === 'loft' ? [6, 4] : undefined}
                    />
                  )}
                  {/* Type label */}
                  <Text x={4} y={4} text={shape.type.charAt(0).toUpperCase() + shape.type.slice(1)} fontSize={10} fill="#a1a1aa" listening={false} />
                  {/* Dimension label — outside bottom-right */}
                  <Text x={sw + 4} y={sh + 2} text={`${fmtDim(shape.width)} x ${fmtDim(shape.depth)}`} fontSize={10} fill="#71717a" listening={false} />
                </Group>

                {/* ── Handles (show on hover or selection) ── */}
                {showHandles && (
                  <>
                    {/* 4 CORNER handles */}
                    {([
                      { cx: sx, cy: sy, cur: 'nwse-resize', onMove: (hx: number, hy: number) => {
                        const nX = (hx + 4 - pan.x) / scale, nY = (hy + 4 - pan.y) / scale;
                        return { x: nX, y: nY, width: Math.max(0.1, shape.x + shape.width - nX), depth: Math.max(0.1, shape.y + shape.depth - nY) };
                      }},
                      { cx: sx + sw, cy: sy, cur: 'nesw-resize', onMove: (hx: number, hy: number) => {
                        const nY = (hy + 4 - pan.y) / scale;
                        return { y: nY, width: Math.max(0.1, (hx + 4 - pan.x) / scale - shape.x), depth: Math.max(0.1, shape.y + shape.depth - nY) };
                      }},
                      { cx: sx, cy: sy + sh, cur: 'nesw-resize', onMove: (hx: number, hy: number) => {
                        const nX = (hx + 4 - pan.x) / scale;
                        return { x: nX, width: Math.max(0.1, shape.x + shape.width - nX), depth: Math.max(0.1, (hy + 4 - pan.y) / scale - shape.y) };
                      }},
                      { cx: sx + sw, cy: sy + sh, cur: 'nwse-resize', onMove: (hx: number, hy: number) => {
                        return { width: Math.max(0.1, (hx + 4 - pan.x) / scale - shape.x), depth: Math.max(0.1, (hy + 4 - pan.y) / scale - shape.y) };
                      }},
                    ] as const).map((h, i) => (
                      <Rect key={`corner-${i}`} x={h.cx - 4} y={h.cy - 4} width={8} height={8} fill="#3b82f6" cornerRadius={1}
                        onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = h.cur; }}
                        onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                        draggable
                        onDragMove={(e) => resizeFromHandle(shape.id, e, h.onMove)}
                      />
                    ))}

                    {/* 4 EDGE handles (visible bars) */}
                    {([
                      { x: sx + sw - 2, y: sy + sh * 0.3, w: 4, h: sh * 0.4, cur: 'ew-resize',
                        bound: (pos: {x:number;y:number}) => ({ x: pos.x, y: sy + sh * 0.3 }),
                        onMove: (hx: number) => ({ width: Math.max(0.1, (hx + 2 - pan.x) / scale - shape.x) }) },
                      { x: sx - 2, y: sy + sh * 0.3, w: 4, h: sh * 0.4, cur: 'ew-resize',
                        bound: (pos: {x:number;y:number}) => ({ x: pos.x, y: sy + sh * 0.3 }),
                        onMove: (hx: number) => { const nX = (hx + 2 - pan.x) / scale; return { x: nX, width: Math.max(0.1, shape.x + shape.width - nX) }; } },
                      { x: sx + sw * 0.3, y: sy + sh - 2, w: sw * 0.4, h: 4, cur: 'ns-resize',
                        bound: (pos: {x:number;y:number}) => ({ x: sx + sw * 0.3, y: pos.y }),
                        onMove: (_: number, hy: number) => ({ depth: Math.max(0.1, (hy + 2 - pan.y) / scale - shape.y) }) },
                      { x: sx + sw * 0.3, y: sy - 2, w: sw * 0.4, h: 4, cur: 'ns-resize',
                        bound: (pos: {x:number;y:number}) => ({ x: sx + sw * 0.3, y: pos.y }),
                        onMove: (_: number, hy: number) => { const nY = (hy + 2 - pan.y) / scale; return { y: nY, depth: Math.max(0.1, shape.y + shape.depth - nY) }; } },
                    ] as const).map((h, i) => (
                      <Rect key={`edge-${i}`} x={h.x} y={h.y} width={h.w} height={h.h}
                        fill="#3b82f6" opacity={0.35} cornerRadius={2}
                        onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = h.cur; e.target.opacity(0.7); }}
                        onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; e.target.opacity(0.35); }}
                        draggable
                        dragBoundFunc={h.bound}
                        onDragMove={(e) => {
                          const updates = h.onMove(e.target.x(), e.target.y());
                          handleShapeResize(shape.id, updates);
                        }}
                      />
                    ))}

                    {/* 4 WALL ARC handles (circles, only when selected for less clutter) */}
                    {isSelected && ([
                      { cx: sx + sw / 2, cy: sy, wall: 'top', dir: 'y' as const,
                        bound: (pos: {x:number;y:number}) => ({ x: sx + sw / 2, y: pos.y }),
                        offset: (hy: number) => (sy - hy) / scale },
                      { cx: sx + sw / 2, cy: sy + sh, wall: 'bottom', dir: 'y' as const,
                        bound: (pos: {x:number;y:number}) => ({ x: sx + sw / 2, y: pos.y }),
                        offset: (hy: number) => (hy - (sy + sh)) / scale },
                      { cx: sx, cy: sy + sh / 2, wall: 'left', dir: 'x' as const,
                        bound: (pos: {x:number;y:number}) => ({ x: pos.x, y: sy + sh / 2 }),
                        offset: (hx: number) => (sx - hx) / scale },
                      { cx: sx + sw, cy: sy + sh / 2, wall: 'right', dir: 'x' as const,
                        bound: (pos: {x:number;y:number}) => ({ x: pos.x, y: sy + sh / 2 }),
                        offset: (hx: number) => (hx - (sx + sw)) / scale },
                    ] as const).map((h) => (
                      <Circle key={`arc-${h.wall}`}
                        x={h.cx + (h.dir === 'x' ? -(shape.wallCurves?.[h.wall] ?? 0) * scale * (h.wall === 'left' ? 1 : -1) : 0)}
                        y={h.cy + (h.dir === 'y' ? -(shape.wallCurves?.[h.wall] ?? 0) * scale * (h.wall === 'top' ? 1 : -1) : 0)}
                        radius={6} fill="#3b82f6" opacity={0.6}
                        onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = h.dir === 'y' ? 'ns-resize' : 'ew-resize'; }}
                        onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                        draggable
                        dragBoundFunc={h.bound}
                        onDragMove={(e) => {
                          const val = h.dir === 'y' ? h.offset(e.target.y()) : h.offset(e.target.x());
                          handleWallCurve(shape.id, h.wall, val);
                        }}
                      />
                    ))}
                  </>
                )}
              </Group>
            );
          })}

          {/* Drawing preview */}
          {drawing && (
            <Group>
              <Rect x={drawing.current.x * scale + pan.x} y={drawing.current.y * scale + pan.y}
                width={drawing.current.width * scale} height={drawing.current.depth * scale}
                fill={SHAPE_FILLS[drawing.current.type]} stroke="#3b82f6" strokeWidth={2} dash={[6, 3]} listening={false} />
              <Text x={drawing.current.x * scale + pan.x + drawing.current.width * scale + 6}
                y={drawing.current.y * scale + pan.y + drawing.current.depth * scale - 14}
                text={`${fmtDim(drawing.current.width)} x ${fmtDim(drawing.current.depth)}`}
                fontSize={12} fill="#3b82f6" fontStyle="bold" listening={false} />
            </Group>
          )}
        </Layer>

        {/* Beds */}
        <Layer>
          {bedPlacements.map((bp) => {
            const bed = beds.find((b) => b.id === bp.bedId);
            if (!bed) return null;
            return (
              <BedShape key={bp.id} placement={bp} bed={bed} scale={scale} panX={pan.x} panY={pan.y}
                isSelected={selectedId === bp.id}
                onSelect={() => setSelectedId(bp.id)}
                onDragMove={(e) => handleBedDragMove(e, bp.bedId)}
                onDragEnd={(x, y) => handleBedDrag(bp.id, x, y)}
                onRotate={(r) => handleBedRotate(bp.id, r)}
                draggable={activeTool === 'select'}
              />
            );
          })}
          <SplitKingConnectors placements={bedPlacements} beds={beds} scale={scale} panX={pan.x} panY={pan.y}
            onTogglePair={(idA, idB) => {
              setBedPlacements((prev) => {
                const a = prev.find((p) => p.id === idA);
                const b = prev.find((p) => p.id === idB);
                if (!a || !b) return prev;
                if (a.splitKingPairId === idB) {
                  return prev.map((p) => (p.id === idA || p.id === idB) ? { ...p, splitKingPairId: null } : p);
                }
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
              });
            }}
          />
        </Layer>

        {/* Labels */}
        <Layer>
          {labels.map((label) => (
            <Text key={label.id} x={label.x * scale + pan.x} y={label.y * scale + pan.y}
              text={label.text || 'Add text...'} fontSize={label.fontSize}
              fill={label.text ? '#44403c' : '#d4d4d8'} fontStyle={label.text ? 'normal' : 'italic'}
              draggable={activeTool === 'select'}
              onClick={() => { setSelectedId(label.id); setEditingLabel({ id: label.id, text: label.text }); }}
              onDragEnd={(e) => {
                const newX = (e.target.x() - pan.x) / scale;
                const newY = (e.target.y() - pan.y) / scale;
                setLabels((prev) => prev.map((l) => (l.id === label.id ? { ...l, x: newX, y: newY } : l)));
              }}
            />
          ))}
        </Layer>
      </Stage>

      {/* Label modal */}
      <Dialog open={!!editingLabel} onOpenChange={(open) => { if (!open) handleLabelCancel(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Label</DialogTitle></DialogHeader>
          <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Enter label text..." value={editingLabel?.text ?? ''}
            onChange={(e) => setEditingLabel((prev) => prev ? { ...prev, text: e.target.value } : null)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSave(); if (e.key === 'Escape') handleLabelCancel(); }}
            autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={handleLabelCancel}>Cancel</Button>
            <Button onClick={handleLabelSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
