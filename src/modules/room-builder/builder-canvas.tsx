'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Line, Circle, Transformer, Shape } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { BedShape } from './bed-shape';
import { SplitKingConnectors } from './split-king-connector';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  BASE_SCALE, M_TO_FT, BED_PRESETS,
  type LayoutShape, type LayoutBedPlacement, type LayoutLabel, type LayoutUnit, type LayoutShapeType,
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
const SHAPE_FILLS: Record<LayoutShapeType, string> = { room: '#f5f5f4', bathroom: '#e0f2fe', deck: '#f0fdf4', loft: '#fef3c7' };
const SHAPE_STROKES: Record<LayoutShapeType, string> = { room: '#78716c', bathroom: '#7dd3fc', deck: '#86efac', loft: '#fcd34d' };

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// ── Per-shape component ──
function RoomShape({
  shape, scale, panX, panY, unit, isSelected, isHovered,
  onSelect, onShapeChange, onMouseEnter, onMouseLeave,
  beds, bedPlacements, setBedPlacements,
  activeTool, stageRef,
}: {
  shape: LayoutShape; scale: number; panX: number; panY: number; unit: LayoutUnit;
  isSelected: boolean; isHovered: boolean;
  onSelect: () => void;
  onShapeChange: (updates: Partial<LayoutShape>) => void;
  onMouseEnter: () => void; onMouseLeave: () => void;
  beds: RoomBed[]; bedPlacements: LayoutBedPlacement[];
  setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>>;
  activeTool: ActiveTool;
  stageRef: React.RefObject<Konva.Stage | null>;
}) {
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const sw = shape.width * scale;
  const sh = shape.depth * scale;
  const sx = shape.x * scale + panX;
  const sy = shape.y * scale + panY;
  const showHandles = isSelected || isHovered;
  const hasCurves = Object.values(shape.wallCurves ?? {}).some((v) => v !== 0);

  // Attach Transformer when selected
  useEffect(() => {
    if (isSelected && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const fmtDim = (m: number) => unit === 'feet' ? `${(m * M_TO_FT).toFixed(1)}ft` : `${m.toFixed(2)}m`;

  // Grid lines (positions relative to 0,0 of the group)
  const gridLines: React.ReactNode[] = [];
  const minorStep = unit === 'meters' ? 0.1 : 0.0762;
  const majorStep = unit === 'meters' ? 1.0 : 0.3048;
  if (scale * minorStep > 4) {
    for (let x = Math.ceil(shape.x / minorStep) * minorStep; x < shape.x + shape.width; x += minorStep)
      gridLines.push(<Line key={`mv${x.toFixed(4)}`} points={[(x - shape.x) * scale, 0, (x - shape.x) * scale, sh]} stroke={GRID_MINOR} strokeWidth={0.5} listening={false} />);
    for (let y = Math.ceil(shape.y / minorStep) * minorStep; y < shape.y + shape.depth; y += minorStep)
      gridLines.push(<Line key={`mh${y.toFixed(4)}`} points={[0, (y - shape.y) * scale, sw, (y - shape.y) * scale]} stroke={GRID_MINOR} strokeWidth={0.5} listening={false} />);
  }
  for (let x = Math.ceil(shape.x / majorStep) * majorStep; x < shape.x + shape.width; x += majorStep)
    gridLines.push(<Line key={`Mv${x.toFixed(4)}`} points={[(x - shape.x) * scale, 0, (x - shape.x) * scale, sh]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
  for (let y = Math.ceil(shape.y / majorStep) * majorStep; y < shape.y + shape.depth; y += majorStep)
    gridLines.push(<Line key={`Mh${y.toFixed(4)}`} points={[0, (y - shape.y) * scale, sw, (y - shape.y) * scale]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);

  // Find and move bed Konva nodes during room drag
  const moveBedNodes = (dx: number, dy: number) => {
    const stage = stageRef.current;
    if (!stage || !stage.children) return;
    // Beds layer is index 2
    const bedsLayer = stage.children[2];
    if (!bedsLayer || !bedsLayer.children) return;
    // Get bed IDs that are inside this shape
    const insideBedIds = new Set<string>();
    for (const bp of bedPlacements) {
      const bed = beds.find((b) => b.id === bp.bedId);
      const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
      if (!preset) continue;
      const bcx = bp.x + preset.width / 2, bcy = bp.y + preset.length / 2;
      if (bcx >= shape.x && bcx <= shape.x + shape.width && bcy >= shape.y && bcy <= shape.y + shape.depth)
        insideBedIds.add(bp.id);
    }
    // Move matching Konva nodes
    for (const node of bedsLayer.children) {
      const bedPlacementId = node.attrs?.['data-placement-id'];
      if (bedPlacementId && insideBedIds.has(bedPlacementId)) {
        node.x(node.x() + dx);
        node.y(node.y() + dy);
      }
    }
    bedsLayer.batchDraw();
  };

  return (
    <>
      {/* ── Single draggable Group: grid + fill + border + labels all move together ── */}
      <Group
        x={sx} y={sy}
        draggable={activeTool === 'select'}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={() => {
          dragStartPos.current = { x: sx, y: sy };
        }}
        onDragMove={(e) => {
          if (!dragStartPos.current) return;
          const curX = e.target.x(), curY = e.target.y();
          const dx = curX - dragStartPos.current.x;
          const dy = curY - dragStartPos.current.y;
          dragStartPos.current = { x: curX, y: curY };
          moveBedNodes(dx, dy);
        }}
        onDragEnd={(e) => {
          const newX = (e.target.x() - panX) / scale;
          const newY = (e.target.y() - panY) / scale;
          const dx = newX - shape.x, dy = newY - shape.y;
          onShapeChange({ x: newX, y: newY });
          // Commit bed movements to React state
          if (dx !== 0 || dy !== 0) {
            setBedPlacements((bps) =>
              bps.map((bp) => {
                const bed = beds.find((b) => b.id === bp.bedId);
                const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
                if (!preset) return bp;
                const bcx = bp.x + preset.width / 2, bcy = bp.y + preset.length / 2;
                if (bcx >= shape.x && bcx <= shape.x + shape.width && bcy >= shape.y && bcy <= shape.y + shape.depth)
                  return { ...bp, x: bp.x + dx, y: bp.y + dy };
                return bp;
              }),
            );
          }
          dragStartPos.current = null;
        }}
      >
        {/* Fill + grid clipped to shape path (supports curved walls) */}
        <Group clipFunc={(ctx) => {
          const c = shape.wallCurves ?? {};
          const ta = (c.top ?? 0) * scale, ba = (c.bottom ?? 0) * scale;
          const la = (c.left ?? 0) * scale, ra = (c.right ?? 0) * scale;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          if (ta) { ctx.quadraticCurveTo(sw / 2, -ta, sw, 0); } else { ctx.lineTo(sw, 0); }
          if (ra) { ctx.quadraticCurveTo(sw + ra, sh / 2, sw, sh); } else { ctx.lineTo(sw, sh); }
          if (ba) { ctx.quadraticCurveTo(sw / 2, sh + ba, 0, sh); } else { ctx.lineTo(0, sh); }
          if (la) { ctx.quadraticCurveTo(-la, sh / 2, 0, 0); } else { ctx.lineTo(0, 0); }
          ctx.closePath();
        }} listening={false}>
          <Rect x={-50} y={-50} width={sw + 100} height={sh + 100} fill={SHAPE_FILLS[shape.type]} />
          {gridLines}
        </Group>

        {/* Invisible Rect for Transformer to attach to (no visible stroke) */}
        <Rect
          ref={rectRef}
          x={0} y={0} width={sw} height={sh}
          fill="transparent" stroke="transparent" strokeWidth={0}
          onTransformEnd={() => {
            const node = rectRef.current;
            if (!node) return;
            const scX = node.scaleX(), scY = node.scaleY();
            node.scaleX(1); node.scaleY(1);
            const newW = Math.max(0.1, (node.width() * scX) / scale);
            const newH = Math.max(0.1, (node.height() * scY) / scale);
            const newX = shape.x + node.x() / scale;
            const newY = shape.y + node.y() / scale;
            node.x(0); node.y(0);
            onShapeChange({ x: newX, y: newY, width: newW, depth: newH });
          }}
        />

        {/* Visible border — draws each wall as straight line or bezier curve */}
        <Shape
          sceneFunc={(ctx, konvaShape) => {
            const c = shape.wallCurves ?? {};
            const ta = (c.top ?? 0) * scale, ba = (c.bottom ?? 0) * scale;
            const la = (c.left ?? 0) * scale, ra = (c.right ?? 0) * scale;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            if (ta) { ctx.quadraticCurveTo(sw / 2, -ta, sw, 0); } else { ctx.lineTo(sw, 0); }
            if (ra) { ctx.quadraticCurveTo(sw + ra, sh / 2, sw, sh); } else { ctx.lineTo(sw, sh); }
            if (ba) { ctx.quadraticCurveTo(sw / 2, sh + ba, 0, sh); } else { ctx.lineTo(0, sh); }
            if (la) { ctx.quadraticCurveTo(-la, sh / 2, 0, 0); } else { ctx.lineTo(0, 0); }
            ctx.closePath();
            ctx.fillStrokeShape(konvaShape);
          }}
          stroke={isSelected ? '#3b82f6' : SHAPE_STROKES[shape.type]}
          strokeWidth={isSelected ? 2 : 1}
          dash={shape.type === 'loft' ? [6, 4] : undefined}
          listening={false}
        />

        {/* Type label */}
        <Text x={4} y={4} text={shape.type.charAt(0).toUpperCase() + shape.type.slice(1)} fontSize={10} fill="#a1a1aa" listening={false} />
        {/* Dimension label outside bottom-right */}
        <Text x={sw + 4} y={sh + 2} text={`${fmtDim(shape.width)} x ${fmtDim(shape.depth)}`} fontSize={10} fill="#71717a" listening={false} />
      </Group>

      {/* ── Transformer (selected only) ── */}
      {showHandles && isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          rotateEnabled={false}
          borderStroke="#3b82f6"
          borderStrokeWidth={1}
          anchorFill="#3b82f6"
          anchorStroke="#ffffff"
          anchorSize={8}
          anchorCornerRadius={1}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
          boundBoxFunc={(_oldBox, newBox) => {
            if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) return _oldBox;
            return newBox;
          }}
        />
      )}

      {/* ── Wall arc handles (selected only) ── */}
      {isSelected && ([
        { key: 'top', cx: sx + sw / 2, cy: sy, axis: 'y' as const, sign: -1 },
        { key: 'bottom', cx: sx + sw / 2, cy: sy + sh, axis: 'y' as const, sign: 1 },
        { key: 'left', cx: sx, cy: sy + sh / 2, axis: 'x' as const, sign: -1 },
        { key: 'right', cx: sx + sw, cy: sy + sh / 2, axis: 'x' as const, sign: 1 },
      ]).map((h) => {
        const curveVal = (shape.wallCurves?.[h.key] ?? 0) * scale;
        const hx = h.axis === 'x' ? h.cx + curveVal * h.sign : h.cx;
        const hy = h.axis === 'y' ? h.cy + curveVal * h.sign : h.cy;
        return (
          <Circle key={`arc-${h.key}`} x={hx} y={hy} radius={6} fill="#10b981" opacity={0.8}
            draggable
            dragBoundFunc={h.axis === 'y' ? (pos) => ({ x: h.cx, y: pos.y }) : (pos) => ({ x: pos.x, y: h.cy })}
            onDragMove={(e) => {
              const offset = h.axis === 'y'
                ? (e.target.y() - h.cy) * h.sign / scale
                : (e.target.x() - h.cx) * h.sign / scale;
              onShapeChange({ wallCurves: { ...(shape.wallCurves ?? {}), [h.key]: offset } });
            }}
          />
        );
      })}
    </>
  );
}

// ── Main Canvas ──
export function BuilderCanvas({
  shapes, setShapes, bedPlacements, setBedPlacements, labels, setLabels,
  beds, unit, activeTool, shapePreset, selectedId, setSelectedId, setActiveTool,
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

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver((entries) => setStageSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }));
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const screenToMeters = useCallback(
    (sx: number, sy: number) => ({ x: (sx - pan.x) / scale, y: (sy - pan.y) / scale }),
    [pan, scale],
  );

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition(); if (!pointer) return;
    const dir = e.evt.deltaY < 0 ? 1 : -1;
    const newZoom = Math.max(0.2, Math.min(5, dir > 0 ? zoom * 1.08 : zoom / 1.08));
    setPan({ x: pointer.x - ((pointer.x - pan.x) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom), y: pointer.y - ((pointer.y - pan.y) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom) });
    setZoom(newZoom);
  }, [zoom, pan]);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) { e.evt.preventDefault(); return; }
    // Middle mouse always pans
    if (e.evt.button === 1) { e.evt.preventDefault(); return; }
    if (activeTool === 'rectangle') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      setDrawing({ startX: pos.x, startY: pos.y, current: { id: generateId(), type: shapePreset, x: pos.x, y: pos.y, width: 0, depth: 0, rotation: 0, curve: null } });
    } else if (activeTool === 'text') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const lbl: LayoutLabel = { id: generateId(), text: '', x: pos.x, y: pos.y, rotation: 0, fontSize: 14 };
      setLabels((p) => [...p, lbl]); setSelectedId(lbl.id); setActiveTool('select');
      setEditingLabel({ id: lbl.id, text: '' });
    } else if (activeTool === 'select') {
      const t = e.target;
      const clickedEmpty = t === stageRef.current || (t.getClassName?.() === 'Rect' && t.attrs.name === 'grid-bg');
      if (clickedEmpty) {
        setSelectedId(null);
        // Start panning on left-click drag of empty background
        setPanning(true);
        panStart.current = { x: e.evt.clientX - pan.x, y: e.evt.clientY - pan.y };
      }
    }
  }, [activeTool, shapePreset, screenToMeters, setLabels, setSelectedId, setActiveTool, pan]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!drawing) return;
    const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
    setDrawing((p) => p ? { ...p, current: { ...p.current, x: Math.min(p.startX, pos.x), y: Math.min(p.startY, pos.y), width: Math.abs(pos.x - p.startX), depth: Math.abs(pos.y - p.startY) } } : null);
  }, [drawing, screenToMeters]);

  const handleMouseUp = useCallback(() => {
    if (drawing && drawing.current.width > 0.05 && drawing.current.depth > 0.05) {
      setShapes((p) => [...p, drawing.current]); setSelectedId(drawing.current.id); setActiveTool('select');
    }
    setDrawing(null);
  }, [drawing, setShapes, setSelectedId, setActiveTool]);

  // Pan
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onDown = (e: MouseEvent) => { if (e.button === 1) { e.preventDefault(); setPanning(true); panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; } }; // middle-click pan (left-click pan handled in handleMouseDown)
    const onMove = (e: MouseEvent) => { if (panning) setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); };
    const onUp = () => setPanning(false);
    el.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [panning, pan]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setShapes((p) => p.filter((s) => s.id !== selectedId));
        setBedPlacements((p) => p.filter((bp) => bp.id !== selectedId));
        setLabels((p) => p.filter((l) => l.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'Escape') { setSelectedId(null); setActiveTool('select'); setDrawing(null); }
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'r' || e.key === 'R') setActiveTool('rectangle');
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, setShapes, setBedPlacements, setLabels, setSelectedId, setActiveTool]);

  // Bed snap
  const snapBedInsideWalls = useCallback((bedX: number, bedY: number, bedW: number, bedH: number) => {
    if (shapes.length === 0) return { x: bedX, y: bedY };
    let bx = bedX, by = bedY, bd = Infinity;
    for (const s of shapes) {
      if (s.width < bedW || s.depth < bedH) continue;
      const cx = Math.max(s.x, Math.min(bedX, s.x + s.width - bedW));
      const cy = Math.max(s.y, Math.min(bedY, s.y + s.depth - bedH));
      const d = (cx - bedX) ** 2 + (cy - bedY) ** 2;
      if (d < bd) { bd = d; bx = cx; by = cy; }
    }
    if (bd === Infinity && shapes.length > 0) {
      const s = shapes[0];
      bx = Math.max(s.x, Math.min(bedX, s.x + s.width - bedW));
      by = Math.max(s.y, Math.min(bedY, s.y + s.depth - bedH));
    }
    return { x: bx, y: by };
  }, [shapes]);

  // Live bed constraint
  const handleBedDragMove = useCallback((e: KonvaEventObject<DragEvent>, bedId: string) => {
    const bed = beds.find((b) => b.id === bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (!preset) return;
    const snapped = snapBedInsideWalls((e.target.x() - pan.x) / scale, (e.target.y() - pan.y) / scale, preset.width, preset.length);
    e.target.x(snapped.x * scale + pan.x);
    e.target.y(snapped.y * scale + pan.y);
  }, [beds, pan, scale, snapBedInsideWalls]);

  // Bed drop from palette
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { bedId: string; bedType: string; x: number; y: number };
      const stage = stageRef.current; if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      if (d.x < rect.left || d.x > rect.right || d.y < rect.top || d.y > rect.bottom) return;
      const pos = screenToMeters(d.x - rect.left, d.y - rect.top);
      const preset = BED_PRESETS.find((p) => p.type === d.bedType); if (!preset) return;
      const snapped = snapBedInsideWalls(pos.x - preset.width / 2, pos.y - preset.length / 2, preset.width, preset.length);
      setBedPlacements((p) => [...p, { id: generateId(), bedId: d.bedId, x: snapped.x, y: snapped.y, rotation: 0, splitKingPairId: null }]);
    };
    window.addEventListener('room-builder-drop-bed', handler);
    return () => window.removeEventListener('room-builder-drop-bed', handler);
  }, [screenToMeters, setBedPlacements, snapBedInsideWalls]);

  const handleBedDragEnd = (id: string, x: number, y: number) => {
    setBedPlacements((prev) => {
      const bp = prev.find((p) => p.id === id); if (!bp) return prev;
      const bed = beds.find((b) => b.id === bp.bedId);
      const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
      if (preset) { const s = snapBedInsideWalls(x, y, preset.width, preset.length); return prev.map((p) => (p.id === id ? { ...p, x: s.x, y: s.y } : p)); }
      return prev.map((p) => (p.id === id ? { ...p, x, y } : p));
    });
  };

  const fmtDim = (m: number) => unit === 'feet' ? `${(m * M_TO_FT).toFixed(1)}ft` : `${m.toFixed(2)}m`;
  const cursor = activeTool === 'rectangle' ? 'crosshair' : activeTool === 'text' ? 'text' : panning ? 'grabbing' : 'default';

  return (
    <div ref={containerRef} className="h-full w-full relative" style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
      <Stage ref={stageRef} width={stageSize.width} height={stageSize.height}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

        <Layer listening={false}>
          <Rect name="grid-bg" x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#ffffff" />
        </Layer>

        {/* Shapes + Transformer */}
        <Layer>
          {shapes.map((shape) => (
            <RoomShape key={shape.id} shape={shape} scale={scale} panX={pan.x} panY={pan.y} unit={unit}
              isSelected={selectedId === shape.id}
              isHovered={hoveredShapeId === shape.id}
              onSelect={() => setSelectedId(shape.id)}
              onShapeChange={(u) => setShapes((p) => p.map((s) => (s.id === shape.id ? { ...s, ...u } : s)))}
              onMouseEnter={() => setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId((p) => p === shape.id ? null : p)}
              beds={beds} bedPlacements={bedPlacements} setBedPlacements={setBedPlacements}
              activeTool={activeTool} stageRef={stageRef}
            />
          ))}
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
                onDragEnd={(x, y) => handleBedDragEnd(bp.id, x, y)}
                onRotate={(r) => setBedPlacements((p) => p.map((b) => (b.id === bp.id ? { ...b, rotation: r } : b)))}
                draggable={activeTool === 'select'}
                placementId={bp.id}
              />
            );
          })}
          <SplitKingConnectors placements={bedPlacements} beds={beds} scale={scale} panX={pan.x} panY={pan.y}
            onTogglePair={(idA, idB) => {
              setBedPlacements((prev) => {
                const a = prev.find((p) => p.id === idA), b = prev.find((p) => p.id === idB);
                if (!a || !b) return prev;
                if (a.splitKingPairId === idB) return prev.map((p) => (p.id === idA || p.id === idB) ? { ...p, splitKingPairId: null } : p);
                const preset = BED_PRESETS.find((p) => p.type === 'single_long'); if (!preset) return prev;
                const leftId = a.x <= b.x ? idA : idB, rightId = a.x <= b.x ? idB : idA, left = a.x <= b.x ? a : b;
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
                setLabels((p) => p.map((l) => (l.id === label.id ? { ...l, x: (e.target.x() - pan.x) / scale, y: (e.target.y() - pan.y) / scale } : l)));
              }}
            />
          ))}
        </Layer>
      </Stage>

      <Dialog open={!!editingLabel} onOpenChange={(open) => { if (!open) setEditingLabel(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Label</DialogTitle></DialogHeader>
          <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Enter label text..." value={editingLabel?.text ?? ''}
            onChange={(e) => setEditingLabel((p) => p ? { ...p, text: e.target.value } : null)}
            onKeyDown={(e) => { if (e.key === 'Enter' && editingLabel) { setLabels((p) => p.map((l) => (l.id === editingLabel.id ? { ...l, text: editingLabel.text } : l))); setEditingLabel(null); } if (e.key === 'Escape') setEditingLabel(null); }}
            autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLabel(null)}>Cancel</Button>
            <Button onClick={() => { if (editingLabel) { setLabels((p) => p.map((l) => (l.id === editingLabel.id ? { ...l, text: editingLabel.text } : l))); setEditingLabel(null); } }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
