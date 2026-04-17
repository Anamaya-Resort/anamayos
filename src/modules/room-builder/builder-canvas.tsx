'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Line, Circle, Transformer, Shape } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { BedShape } from './bed-shape';
import { SplitKingConnectors } from './split-king-connector';
import {
  BASE_SCALE, M_TO_FT, BED_PRESETS, FURNITURE_PRESETS,
  type LayoutShape, type LayoutBedPlacement, type LayoutLabel, type LayoutFurniture, type LayoutOpening, type LayoutArrow,
  type LayoutUnit, type LayoutShapeType, type ResortConfig,
} from './types';
import type { RoomBed, ActiveTool, ShapePreset, FurniturePresetType } from './room-builder-shell';

interface BuilderCanvasProps {
  shapes: LayoutShape[];
  setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>>;
  bedPlacements: LayoutBedPlacement[];
  setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>>;
  labels: LayoutLabel[];
  setLabels: React.Dispatch<React.SetStateAction<LayoutLabel[]>>;
  furniture: LayoutFurniture[];
  setFurniture: React.Dispatch<React.SetStateAction<LayoutFurniture[]>>;
  openings: LayoutOpening[];
  setOpenings: React.Dispatch<React.SetStateAction<LayoutOpening[]>>;
  arrows: LayoutArrow[];
  setArrows: React.Dispatch<React.SetStateAction<LayoutArrow[]>>;
  beds: RoomBed[];
  setBeds: React.Dispatch<React.SetStateAction<RoomBed[]>>;
  roomId: string;
  unit: LayoutUnit;
  activeTool: ActiveTool;
  shapePreset: ShapePreset;
  furniturePreset: FurniturePresetType;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
  resortConfig: ResortConfig;
  thumbnail?: string | null;
  onThumbnailGenerated?: (dataUrl: string) => void;
}

const GRID_MAJOR = '#d4d4d8';
const GRID_MINOR = '#e8e8ec';
const DOOR_COLOR = '#d4a9a1';
const WINDOW_COLOR = '#9bb2c6';

/** A wall segment defined by two points */
interface WallSegment {
  x1: number; y1: number; x2: number; y2: number;
}

/** Get all 4 wall segments of a shape (in meters), offset inward by half wall thickness
 *  so openings are centered on the wall, not on the outer edge */
function getShapeWalls(shape: LayoutShape): WallSegment[] {
  const { x, y, width, depth } = shape;
  const hw = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) / 2; // half wall thickness
  return [
    { x1: x, y1: y + hw, x2: x + width, y2: y + hw },                   // top (offset down)
    { x1: x + width - hw, y1: y, x2: x + width - hw, y2: y + depth },   // right (offset left)
    { x1: x + width, y1: y + depth - hw, x2: x, y2: y + depth - hw },   // bottom (offset up)
    { x1: x + hw, y1: y + depth, x2: x + hw, y2: y },                   // left (offset right)
  ];
}

/** Project point onto a line segment, return projected point and distance */
function projectOntoSegment(px: number, py: number, seg: WallSegment): { x: number; y: number; dist: number; t: number } {
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: seg.x1, y: seg.y1, dist: Math.sqrt((px - seg.x1) ** 2 + (py - seg.y1) ** 2), t: 0 };
  const t = Math.max(0, Math.min(1, ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2));
  const projX = seg.x1 + t * dx, projY = seg.y1 + t * dy;
  const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  return { x: projX, y: projY, dist, t };
}

/** Find the nearest wall segment to a point across all shapes, within maxDist (meters) */
function findNearestWall(px: number, py: number, shapes: LayoutShape[], maxDist: number): { seg: WallSegment; proj: { x: number; y: number; t: number } } | null {
  let best: { seg: WallSegment; proj: { x: number; y: number; t: number }; dist: number } | null = null;
  for (const shape of shapes) {
    for (const seg of getShapeWalls(shape)) {
      const proj = projectOntoSegment(px, py, seg);
      if (proj.dist < maxDist && (!best || proj.dist < best.dist)) {
        best = { seg, proj: { x: proj.x, y: proj.y, t: proj.t }, dist: proj.dist };
      }
    }
  }
  return best ? { seg: best.seg, proj: best.proj } : null;
}
const SHAPE_FILLS: Record<LayoutShapeType, string> = { room: '#f5f5f4', bathroom: '#e0f2fe', deck: '#f5efe6', loft: '#fef3c7' };
const SHAPE_STROKES: Record<LayoutShapeType, string> = { room: '#78716c', bathroom: '#7dd3fc', deck: '#c4a882', loft: '#fcd34d' };
/** Wall fill color — matches brand-btn terra cotta */
const WALL_COLOR = '#A35B4E';
/** Wall thickness in meters */
const WALL_THICKNESS_M = 0.15;

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

/** Measure text width using a hidden canvas */
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
function measureText(text: string, fontSize: number, fontFamily: string, fontStyle: string): number {
  if (!measureCanvas || !text) return 0;
  const weight = fontStyle.includes('bold') ? 'bold' : 'normal';
  const style = fontStyle.includes('italic') ? 'italic' : 'normal';
  measureCanvas.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  return measureCanvas.measureText(text).width;
}

/** Parse a wallCurves entry (supports old number format and new {offset, along} format) */
function parseWallCurve(val: number | { offset: number; along: number } | undefined): { offset: number; along: number } {
  if (val === undefined || val === 0) return { offset: 0, along: 0.5 };
  if (typeof val === 'number') return { offset: val, along: 0.5 };
  return val;
}

/** Trace the INNER wall path (inset by wall thickness).
 *  Counter-clockwise winding so evenodd fill creates a hole when combined with the outer path.
 *  Does NOT call beginPath() — must be called after traceShapePath on the same context. */
function traceInnerPath(ctx: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void; closePath(): void }, sw: number, sh: number, curves: Record<string, { offset: number; along: number } | number> | undefined, scale: number, wallPx: number) {
  const top = parseWallCurve(curves?.top);
  const right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom);
  const left = parseWallCurve(curves?.left);
  const w = wallPx;

  // Counter-clockwise: start at top-left inner corner, go LEFT around
  ctx.moveTo(w, w);
  // Left wall inner (top to bottom)
  if (left.offset) {
    ctx.quadraticCurveTo(-left.offset * scale + w, (sh - 2 * w) * (1 - left.along) + w, w, sh - w);
  } else { ctx.lineTo(w, sh - w); }
  // Bottom wall inner (left to right)
  if (bottom.offset) {
    ctx.quadraticCurveTo((sw - 2 * w) * (1 - bottom.along) + w, sh + bottom.offset * scale - w, sw - w, sh - w);
  } else { ctx.lineTo(sw - w, sh - w); }
  // Right wall inner (bottom to top)
  if (right.offset) {
    ctx.quadraticCurveTo(sw + right.offset * scale - w, (sh - 2 * w) * right.along + w, sw - w, w);
  } else { ctx.lineTo(sw - w, w); }
  // Top wall inner (right to left)
  if (top.offset) {
    ctx.quadraticCurveTo((sw - 2 * w) * top.along + w, -top.offset * scale + w, w, w);
  } else { ctx.lineTo(w, w); }
  ctx.closePath();
}

/** Trace just the inner path as a standalone path (with beginPath). Used for grid clipping. */
function traceInnerPathStandalone(ctx: { beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void; closePath(): void }, sw: number, sh: number, curves: Record<string, { offset: number; along: number } | number> | undefined, scale: number, wallPx: number) {
  const top = parseWallCurve(curves?.top);
  const right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom);
  const left = parseWallCurve(curves?.left);
  const w = wallPx;

  ctx.beginPath();
  ctx.moveTo(w, w);
  if (top.offset) {
    ctx.quadraticCurveTo((sw - 2 * w) * top.along + w, -top.offset * scale + w, sw - w, w);
  } else { ctx.lineTo(sw - w, w); }
  if (right.offset) {
    ctx.quadraticCurveTo(sw + right.offset * scale - w, (sh - 2 * w) * right.along + w, sw - w, sh - w);
  } else { ctx.lineTo(sw - w, sh - w); }
  if (bottom.offset) {
    ctx.quadraticCurveTo((sw - 2 * w) * (1 - bottom.along) + w, sh + bottom.offset * scale - w, w, sh - w);
  } else { ctx.lineTo(w, sh - w); }
  if (left.offset) {
    ctx.quadraticCurveTo(-left.offset * scale + w, (sh - 2 * w) * (1 - left.along) + w, w, w);
  } else { ctx.lineTo(w, w); }
  ctx.closePath();
}

/** Build the shape path on a canvas context. Used for both clipFunc and border sceneFunc.
 *  Accepts any object with beginPath/moveTo/lineTo/quadraticCurveTo/closePath (works for both
 *  raw CanvasRenderingContext2D from clipFunc and Konva.Context from sceneFunc). */
function traceShapePath(ctx: { beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void; closePath(): void }, sw: number, sh: number, curves: Record<string, { offset: number; along: number } | number> | undefined, scale: number) {
  const top = parseWallCurve(curves?.top);
  const right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom);
  const left = parseWallCurve(curves?.left);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  // Top wall (left to right)
  if (top.offset) {
    ctx.quadraticCurveTo(sw * top.along, -top.offset * scale, sw, 0);
  } else { ctx.lineTo(sw, 0); }
  // Right wall (top to bottom)
  if (right.offset) {
    ctx.quadraticCurveTo(sw + right.offset * scale, sh * right.along, sw, sh);
  } else { ctx.lineTo(sw, sh); }
  // Bottom wall (right to left)
  if (bottom.offset) {
    ctx.quadraticCurveTo(sw * (1 - bottom.along), sh + bottom.offset * scale, 0, sh);
  } else { ctx.lineTo(0, sh); }
  // Left wall (bottom to top)
  if (left.offset) {
    ctx.quadraticCurveTo(-left.offset * scale, sh * (1 - left.along), 0, 0);
  } else { ctx.lineTo(0, 0); }
  ctx.closePath();
}

// ── Per-shape component ──
function RoomShape({
  shape, scale, panX, panY, unit, isSelected, isHovered,
  onSelect, onShapeChange, onMouseEnter, onMouseLeave,
  beds, bedPlacements, setBedPlacements,
  activeTool, stageRef, resortConfig, editingShapeId, showTitles, showInfo, startEditing,
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
  resortConfig: ResortConfig;
  editingShapeId: string | null;
  showTitles: boolean;
  showInfo: boolean;
  startEditing: (type: 'label' | 'bedName' | 'shapeTitle' | 'furnitureLabel', id: string, text: string, target: { getAbsolutePosition: () => { x: number; y: number }; getStage: () => Konva.Stage | null }, widthPx: number, style: { fontSize: number; fontFamily: string; fontStyle: string; color: string; align?: string }) => void;
}) {
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const gridGroupRef = useRef<Konva.Group>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const sw = shape.width * scale;
  const sh = shape.depth * scale;
  const sx = shape.x * scale + panX;
  const sy = shape.y * scale + panY;
  const showHandles = isSelected || isHovered;

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
        onClick={() => { if (activeTool === 'select') onSelect(); }}
        onTap={() => { if (activeTool === 'select') onSelect(); }}
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
        {/* Fill + grid clipped to INNER wall path (interior only, not under walls) */}
        <Group ref={gridGroupRef} clipFunc={(ctx) => {
          const wallPx = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) * scale;
          traceInnerPathStandalone(ctx, sw, sh, shape.wallCurves, scale, wallPx);
        }} listening={false}>
          {/* Oversized fill rect so curves beyond the rect bounds get filled */}
          <Rect x={-sw} y={-sh} width={sw * 3} height={sh * 3} fill={SHAPE_FILLS[shape.type]} />
          {/* Extended grid lines so arcs get grid too */}
          {gridLines}
          {/* Extra grid lines for bulge areas */}
          {(() => {
            const extra: React.ReactNode[] = [];
            const majorStep = unit === 'meters' ? 1.0 : 0.3048;
            // Extend grid beyond rect bounds by up to 2m in each direction
            const ext = 2 * scale;
            for (let x = Math.ceil((shape.x - 2) / majorStep) * majorStep; x < shape.x; x += majorStep)
              extra.push(<Line key={`ex-v${x.toFixed(4)}`} points={[(x - shape.x) * scale, -ext, (x - shape.x) * scale, sh + ext]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            for (let x = shape.x + shape.width; x < shape.x + shape.width + 2; x += majorStep)
              extra.push(<Line key={`ex-v${x.toFixed(4)}`} points={[(x - shape.x) * scale, -ext, (x - shape.x) * scale, sh + ext]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            for (let y = Math.ceil((shape.y - 2) / majorStep) * majorStep; y < shape.y; y += majorStep)
              extra.push(<Line key={`ex-h${y.toFixed(4)}`} points={[-ext, (y - shape.y) * scale, sw + ext, (y - shape.y) * scale]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            for (let y = shape.y + shape.depth; y < shape.y + shape.depth + 2; y += majorStep)
              extra.push(<Line key={`ex-h${y.toFixed(4)}`} points={[-ext, (y - shape.y) * scale, sw + ext, (y - shape.y) * scale]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            return extra;
          })()}
        </Group>

        {/* Invisible Rect for Transformer to attach to */}
        <Rect
          ref={rectRef}
          x={0} y={0} width={sw} height={sh}
          fill="transparent" stroke="transparent" strokeWidth={0}
          onTransform={() => {
            // Live-update grid Group to match Transformer's scaling
            const node = rectRef.current;
            const grid = gridGroupRef.current;
            if (!node || !grid) return;
            grid.scaleX(node.scaleX());
            grid.scaleY(node.scaleY());
            grid.x(node.x());
            grid.y(node.y());
            grid.getLayer()?.batchDraw();
          }}
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
            // Reset grid group transform — React re-render will reposition from state
            const grid = gridGroupRef.current;
            if (grid) { grid.scaleX(1); grid.scaleY(1); grid.x(0); grid.y(0); }
            onShapeChange({ x: newX, y: newY, width: newW, depth: newH });
          }}
        />

        {/* Walls — filled band between outer and inner paths */}
        <Shape
          sceneFunc={(ctx) => {
            const wallPx = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) * scale;
            const nativeCtx = ctx._context;
            // Draw outer path
            traceShapePath(nativeCtx, sw, sh, shape.wallCurves, scale);
            // Draw inner path (reverse winding creates a hole with evenodd)
            traceInnerPath(nativeCtx, sw, sh, shape.wallCurves, scale, wallPx);
            nativeCtx.fillStyle = isSelected ? '#3b82f6' : WALL_COLOR;
            nativeCtx.globalAlpha = shape.type === 'loft' ? 0.5 : 1;
            nativeCtx.fill('evenodd');
            nativeCtx.globalAlpha = 1;
          }}
          listening={false}
        />
        {/* Selection outline on top of walls */}
        {isSelected && (
          <Shape
            sceneFunc={(ctx, konvaShape) => {
              traceShapePath(ctx, sw, sh, shape.wallCurves, scale);
              ctx.fillStrokeShape(konvaShape);
            }}
            stroke="#3b82f6"
            strokeWidth={2}
            listening={false}
          />
        )}


        {/* Room title text — centered, offset-draggable, click to edit inline */}
        {showTitles && (() => {
          const titleFs = resortConfig.title.fontSize * scale;
          const titleText = shape.titleText || 'TEXT';
          const tx = sw / 2 + (shape.titleOffsetX ?? 0) * sw;
          const ty = sh / 2 + (shape.titleOffsetY ?? 0) * sh;
          const titleW = Math.max(sw / 3, measureText(titleText, titleFs, resortConfig.title.fontFamily, resortConfig.title.fontStyle) + 8);
          const isEditing = editingShapeId === shape.id;
          return (
            <Group x={tx} y={ty} offsetX={titleW / 2}
              draggable={activeTool === 'select' && !isEditing}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const newOffX = (e.target.x() - sw / 2) / sw;
                const newOffY = (e.target.y() - sh / 2) / sh;
                onShapeChange({ titleOffsetX: Math.max(-0.45, Math.min(0.45, newOffX)), titleOffsetY: Math.max(-0.45, Math.min(0.45, newOffY)) });
              }}
            >
              {/* Background container */}
              {shape.titleText && !isEditing && (
                <Rect x={-2} y={-2} width={titleW + 4} height={titleFs * 1.3 + 4}
                  fill={SHAPE_FILLS[shape.type]} cornerRadius={5} listening={false} />
              )}
              <Text x={0} y={0} width={titleW}
                text={titleText} fontSize={titleFs}
                fontFamily={resortConfig.title.fontFamily}
                fill={shape.titleText ? resortConfig.title.color : '#d4d4d8'}
                fontStyle={shape.titleText ? resortConfig.title.fontStyle : 'italic'}
                align="center"
                visible={!isEditing}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  startEditing('shapeTitle', shape.id, shape.titleText ?? '', e.target, titleW,
                    { fontSize: titleFs, fontFamily: resortConfig.title.fontFamily, fontStyle: resortConfig.title.fontStyle, color: resortConfig.title.color, align: 'center' });
                }}
              />
            </Group>
          );
        })()}

        {/* Type + dimension labels outside bottom-right */}
        {showInfo && (() => {
          const typeText = shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
          const dimText = `${fmtDim(shape.width)} x ${fmtDim(shape.depth)}`;
          const textW = Math.max(measureText(typeText, 10, 'Arial', 'normal'), measureText(dimText, 10, 'Arial', 'normal'));
          return (
            <Group x={sw + 4} y={sh - 10} listening={false}>
              <Rect x={-3} y={-2} width={textW + 6} height={showTitles ? 28 : 16} fill="white" opacity={0.8} cornerRadius={3} />
              {showTitles && <Text x={0} y={0} text={typeText} fontSize={10} fill="#a1a1aa" />}
              <Text x={0} y={showTitles ? 13 : 0} text={dimText} fontSize={10} fill="#71717a" />
            </Group>
          );
        })()}
      </Group>

      {/* ── Transformer (selected only) ── */}
      {showHandles && isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          rotateEnabled={false}
          borderStroke="transparent"
          borderStrokeWidth={0}
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
        { key: 'top', wallStart: { x: sx, y: sy }, wallEnd: { x: sx + sw, y: sy }, perpAxis: 'y' as const, perpSign: -1, wallLen: sw },
        { key: 'bottom', wallStart: { x: sx + sw, y: sy + sh }, wallEnd: { x: sx, y: sy + sh }, perpAxis: 'y' as const, perpSign: 1, wallLen: sw },
        { key: 'right', wallStart: { x: sx + sw, y: sy }, wallEnd: { x: sx + sw, y: sy + sh }, perpAxis: 'x' as const, perpSign: 1, wallLen: sh },
        { key: 'left', wallStart: { x: sx, y: sy + sh }, wallEnd: { x: sx, y: sy }, perpAxis: 'x' as const, perpSign: -1, wallLen: sh },
      ]).map((h) => {
        const wc = parseWallCurve(shape.wallCurves?.[h.key]);
        // Position handle at the control point
        const along = wc.along;
        let hx: number, hy: number;
        if (h.perpAxis === 'y') {
          hx = h.wallStart.x + (h.wallEnd.x - h.wallStart.x) * along;
          hy = h.wallStart.y + wc.offset * scale * h.perpSign;
        } else {
          hx = h.wallStart.x + wc.offset * scale * h.perpSign;
          hy = h.wallStart.y + (h.wallEnd.y - h.wallStart.y) * along;
        }
        return (
          <Circle key={`arc-${h.key}`} x={hx} y={hy} radius={6} fill="#10b981" opacity={0.8}
            draggable
            onDragMove={(e) => {
              const shiftHeld = (e.evt as MouseEvent).shiftKey;
              let offset: number, newAlong: number;
              if (h.perpAxis === 'y') {
                offset = (e.target.y() - h.wallStart.y) * h.perpSign / scale;
                newAlong = shiftHeld ? 0.5 : Math.max(0.1, Math.min(0.9, (e.target.x() - h.wallStart.x) / (h.wallEnd.x - h.wallStart.x)));
                if (shiftHeld) e.target.x(h.wallStart.x + (h.wallEnd.x - h.wallStart.x) * 0.5);
              } else {
                offset = (e.target.x() - h.wallStart.x) * h.perpSign / scale;
                newAlong = shiftHeld ? 0.5 : Math.max(0.1, Math.min(0.9, (e.target.y() - h.wallStart.y) / (h.wallEnd.y - h.wallStart.y)));
                if (shiftHeld) e.target.y(h.wallStart.y + (h.wallEnd.y - h.wallStart.y) * 0.5);
              }
              onShapeChange({ wallCurves: { ...(shape.wallCurves ?? {}), [h.key]: { offset, along: newAlong } } });
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
  furniture, setFurniture, openings, setOpenings, arrows, setArrows, beds, setBeds, roomId, unit, activeTool,
  shapePreset, furniturePreset, selectedId, setSelectedId, setActiveTool, resortConfig, thumbnail, onThumbnailGenerated,
}: BuilderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; current: LayoutShape } | null>(null);
  // Unified inline text editor — one state for all text types
  // Also keep a ref so closures (onChange, commitTextEdit) always read the latest value
  const editingTextRef = useRef<typeof editingText>(null);
  const [editingText, setEditingText] = useState<{
    type: 'label' | 'bedName' | 'shapeTitle' | 'furnitureLabel';
    id: string;           // target entity ID
    text: string;         // current text value
    screenX: number;      // screen position
    screenY: number;
    width: number;        // input width in px
    fontSize: number;     // px
    fontFamily: string;
    fontStyle: string;    // 'normal' | 'bold' | 'italic' | 'bold italic'
    color: string;
    align: string;        // 'left' | 'center'
  } | null>(null);
  // Keep ref in sync
  const setEditingTextAndRef = useCallback((val: typeof editingText | ((prev: typeof editingText) => typeof editingText)) => {
    setEditingText((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      editingTextRef.current = next;
      return next;
    });
  }, []);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showTitles, setShowTitles] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [resizingFurnitureId, setResizingFurnitureId] = useState<string | null>(null);
  const [drawingOpening, setDrawingOpening] = useState<{ type: 'door' | 'window'; seg: WallSegment; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [drawingArrow, setDrawingArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [furnitureSizeModal, setFurnitureSizeModal] = useState<{ id: string; width: string; depth: string } | null>(null);
  const furnitureTransformerRef = useRef<Konva.Transformer>(null);
  const furnitureNodeRef = useRef<Konva.Rect | Konva.Circle | null>(null);

  // Attach furniture Transformer when resizing
  useEffect(() => {
    if (resizingFurnitureId && furnitureTransformerRef.current && furnitureNodeRef.current) {
      furnitureTransformerRef.current.nodes([furnitureNodeRef.current]);
      furnitureTransformerRef.current.getLayer()?.batchDraw();
    }
  }, [resizingFurnitureId, furniture]);

  const scale = BASE_SCALE * zoom;

  // Load Google Fonts dynamically when resortConfig fonts change
  const SYSTEM_FONTS = new Set(['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']);
  useEffect(() => {
    const fonts = new Set([resortConfig.title.fontFamily, resortConfig.info.fontFamily, resortConfig.furniture.fontFamily]);
    const googleFonts = [...fonts].filter((f) => !SYSTEM_FONTS.has(f));
    if (googleFonts.length === 0) return;
    const linkId = 'room-builder-google-fonts';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.id = linkId; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = `https://fonts.googleapis.com/css2?${googleFonts.map((f) => `family=${f.replace(/ /g, '+')}`).join('&')}&display=swap`;
  }, [resortConfig.title.fontFamily, resortConfig.info.fontFamily, resortConfig.furniture.fontFamily]);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver((entries) => setStageSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }));
    obs.observe(el); return () => obs.disconnect();
  }, []);

  // Auto-fit: compute bounding box of all content and set zoom/pan to fit 95% of stage
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (hasAutoFit.current) return;
    if (stageSize.width <= 100 || stageSize.height <= 100) return; // wait for real size
    const allItems: { x: number; y: number; w: number; h: number }[] = [];
    for (const s of shapes) allItems.push({ x: s.x, y: s.y, w: s.width, h: s.depth });
    for (const bp of bedPlacements) {
      const bed = beds.find((b) => b.id === bp.bedId);
      const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
      if (preset) allItems.push({ x: bp.x, y: bp.y, w: preset.width, h: preset.length });
    }
    for (const f of furniture) allItems.push({ x: f.x, y: f.y, w: f.width, h: f.depth });
    for (const l of labels) allItems.push({ x: l.x, y: l.y, w: l.fontSize * 5, h: l.fontSize * 1.5 });
    if (allItems.length === 0) { hasAutoFit.current = true; return; }
    // Add padding for dimension labels, wall thickness, handles, etc.
    const PAD = 0.5; // meters padding on each side
    const minX = Math.min(...allItems.map((i) => i.x)) - PAD;
    const minY = Math.min(...allItems.map((i) => i.y)) - PAD;
    const maxX = Math.max(...allItems.map((i) => i.x + i.w)) + PAD;
    const maxY = Math.max(...allItems.map((i) => i.y + i.h)) + PAD;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) { hasAutoFit.current = true; return; }
    const fitZoomX = stageSize.width / (contentW * BASE_SCALE);
    const fitZoomY = stageSize.height / (contentH * BASE_SCALE);
    const fitZoom = Math.min(fitZoomX, fitZoomY, 3); // cap at 3x
    const fitScale = BASE_SCALE * fitZoom;
    const panX = (stageSize.width - contentW * fitScale) / 2 - minX * fitScale;
    const panY = (stageSize.height - contentH * fitScale) / 2 - minY * fitScale;
    setZoom(fitZoom);
    setPan({ x: panX, y: panY });
    hasAutoFit.current = true;
  }, [stageSize, shapes, bedPlacements, beds, furniture, labels]); // eslint-disable-line react-hooks/exhaustive-deps

  const screenToMeters = useCallback(
    (sx: number, sy: number) => ({ x: (sx - pan.x) / scale, y: (sy - pan.y) / scale }),
    [pan, scale],
  );

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (editingText) { commitTextEdit(); return; } // close editor on zoom
    const pointer = stageRef.current?.getPointerPosition(); if (!pointer) return;
    const dir = e.evt.deltaY < 0 ? 1 : -1;
    const newZoom = Math.max(0.2, Math.min(5, dir > 0 ? zoom * 1.08 : zoom / 1.08));
    setPan({ x: pointer.x - ((pointer.x - pan.x) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom), y: pointer.y - ((pointer.y - pan.y) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom) });
    setZoom(newZoom);
  }, [zoom, pan, editingText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) { e.evt.preventDefault(); return; }
    if (e.evt.button === 1) { e.evt.preventDefault(); return; }
    // Commit any active text edit on any click
    if (editingTextRef.current) commitTextEdit();
    if (activeTool === 'rectangle') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      setDrawing({ startX: pos.x, startY: pos.y, current: { id: generateId(), type: shapePreset, x: pos.x, y: pos.y, width: 0, depth: 0, rotation: 0, curve: null } });
    } else if (activeTool === 'text') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const rc = resortConfig.info;
      const lbl: LayoutLabel = { id: generateId(), text: '', x: pos.x, y: pos.y, rotation: 0, fontSize: rc.fontSize };
      setLabels((p) => [...p, lbl]); setSelectedId(lbl.id); setActiveTool('select');
      const stage = stageRef.current;
      const container = stage?.container().getBoundingClientRect();
      setEditingTextAndRef({ type: 'label', id: lbl.id, text: '', screenX: e.evt.offsetX + (container?.left ?? 0), screenY: e.evt.offsetY + (container?.top ?? 0), width: Math.max(80, rc.fontSize * scale * 8), fontSize: rc.fontSize * scale, fontFamily: rc.fontFamily, fontStyle: rc.fontStyle, color: rc.color, align: 'left' });
    } else if (activeTool === 'furniture') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const fp = FURNITURE_PRESETS.find((p) => p.type === furniturePreset);
      if (fp) {
        setDrawing({ startX: pos.x, startY: pos.y, current: { id: generateId(), type: 'room' as LayoutShapeType, x: pos.x, y: pos.y, width: 0, depth: 0, rotation: 0, curve: null, _furnitureType: furniturePreset } as LayoutShape & { _furnitureType: string } });
      }
    } else if (activeTool === 'arrow') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      setDrawingArrow({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    } else if (activeTool === 'door' || activeTool === 'window') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const maxDistMeters = 10 / scale; // 10 pixels in meters
      const nearest = findNearestWall(pos.x, pos.y, shapes, maxDistMeters);
      if (nearest) {
        setDrawingOpening({ type: activeTool, seg: nearest.seg, x1: nearest.proj.x, y1: nearest.proj.y, x2: nearest.proj.x, y2: nearest.proj.y });
      }
    } else if (activeTool === 'select') {
      const t = e.target;
      const clickedEmpty = t === stageRef.current || (t.getClassName?.() === 'Rect' && t.attrs.name === 'grid-bg');
      if (clickedEmpty) {
        setSelectedId(null);
        setPanning(true);
        panStart.current = { x: e.evt.clientX - pan.x, y: e.evt.clientY - pan.y };
      }
    }
  }, [activeTool, shapePreset, furniturePreset, shapes, scale, screenToMeters, setLabels, setSelectedId, setActiveTool, pan]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (drawingArrow) {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      setDrawingArrow((p) => p ? { ...p, x2: pos.x, y2: pos.y } : null);
      return;
    }
    if (drawingOpening) {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      // Project mouse onto the wall segment (constrain to 1D along wall)
      const proj = projectOntoSegment(pos.x, pos.y, drawingOpening.seg);
      setDrawingOpening((p) => p ? { ...p, x2: proj.x, y2: proj.y } : null);
      return;
    }
    if (!drawing) return;
    const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
    setDrawing((p) => p ? { ...p, current: { ...p.current, x: Math.min(p.startX, pos.x), y: Math.min(p.startY, pos.y), width: Math.abs(pos.x - p.startX), depth: Math.abs(pos.y - p.startY) } } : null);
  }, [drawing, drawingOpening, screenToMeters]);

  const handleMouseUp = useCallback(() => {
    // Opening finalization handled by window-level mouseup listener
    if (drawingOpening) return;
    if (drawing && drawing.current.width > 0.05 && drawing.current.depth > 0.05) {
      const ft = (drawing.current as LayoutShape & { _furnitureType?: string })._furnitureType;
      if (ft) {
        // Drawing was for furniture
        const fp = FURNITURE_PRESETS.find((p) => p.type === ft);
        const item: LayoutFurniture = {
          id: drawing.current.id, type: ft, shape: fp?.shape ?? 'rectangle', label: fp?.label ?? ft,
          x: drawing.current.x, y: drawing.current.y, width: drawing.current.width, depth: drawing.current.depth, rotation: 0,
        };
        setFurniture((p) => [...p, item]); setSelectedId(item.id); setActiveTool('select');
      } else {
        setShapes((p) => [...p, drawing.current]); setSelectedId(drawing.current.id); setActiveTool('select');
      }
    }
    setDrawing(null);
  }, [drawing, drawingOpening, setShapes, setFurniture, setOpenings, setSelectedId, setActiveTool]);

  // Window-level mouseup for arrow drawing
  useEffect(() => {
    if (!drawingArrow) return;
    const onUp = () => {
      const { x1, y1, x2, y2 } = drawingArrow;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (len > 0.05) {
        setArrows((p) => [...p, { id: generateId(), x1, y1, x2, y2 }]);
      }
      setDrawingArrow(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drawingArrow, setArrows]);

  // Window-level mouseup for opening drawing
  useEffect(() => {
    if (!drawingOpening) return;
    const onUp = () => {
      const { type, x1, y1, x2, y2 } = drawingOpening;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (len > 0.05) {
        const { seg } = drawingOpening;
        const opening: LayoutOpening = { id: generateId(), type, x1, y1, x2, y2, wallX1: seg.x1, wallY1: seg.y1, wallX2: seg.x2, wallY2: seg.y2 };
        setOpenings((p) => [...p, opening]);
      }
      setDrawingOpening(null);
      // Stay on the same tool so user can draw another
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drawingOpening, setOpenings]);

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
        setFurniture((p) => p.filter((f) => f.id !== selectedId));
        setOpenings((p) => p.filter((o) => o.id !== selectedId));
        setArrows((p) => p.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'Escape') { setSelectedId(null); setActiveTool('select'); setDrawing(null); setDrawingOpening(null); setDrawingArrow(null); }
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'r' || e.key === 'R') {
        // If a furniture item is selected, rotate it 15° clockwise (not planter/circle)
        const selFurniture = selectedId ? furniture.find((f) => f.id === selectedId) : null;
        if (selFurniture && selFurniture.shape !== 'circle') {
          setFurniture((p) => p.map((f) => f.id === selectedId ? { ...f, rotation: (f.rotation + 15) % 360 } : f));
        } else {
          setActiveTool('rectangle');
        }
      }
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
      if (e.key === 'f' || e.key === 'F') setActiveTool('furniture');
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, furniture, setShapes, setBedPlacements, setLabels, setFurniture, setOpenings, setArrows, setSelectedId, setActiveTool]);

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
  // Bed drag constraint — coords are now center-based (BedShape uses offsetX/offsetY)
  const handleBedDragMove = useCallback((e: KonvaEventObject<DragEvent>, bedId: string) => {
    const bed = beds.find((b) => b.id === bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (!preset) return;
    const bw = preset.width * scale, bh = preset.length * scale;
    // e.target.x/y is the center (because of offsetX/offsetY on Group)
    const topLeftX = (e.target.x() - bw / 2 - pan.x) / scale;
    const topLeftY = (e.target.y() - bh / 2 - pan.y) / scale;
    const snapped = snapBedInsideWalls(topLeftX, topLeftY, preset.width, preset.length);
    e.target.x(snapped.x * scale + pan.x + bw / 2);
    e.target.y(snapped.y * scale + pan.y + bh / 2);
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

  // Rename a bed (update state + DB)
  // Bed rename — local state only, persisted on Save
  const handleBedRename = (bedId: string, newLabel: string) => {
    setBeds((prev) => prev.map((b) => (b.id === bedId ? { ...b, label: newLabel } : b)));
  };

  // Commit text edit — final trim + close editor
  // Commit reads from ref (never stale) — trims and closes editor
  const commitTextEdit = () => {
    const et = editingTextRef.current;
    if (!et) return;
    const { type, id, text } = et;
    const trimmed = text.trim();
    if (type === 'label') setLabels((p) => p.map((l) => l.id === id ? { ...l, text: trimmed } : l));
    if (type === 'bedName') setBeds((p) => p.map((b) => b.id === id ? { ...b, label: trimmed || b.label } : b));
    if (type === 'shapeTitle') setShapes((p) => p.map((s) => s.id === id ? { ...s, titleText: trimmed } : s));
    if (type === 'furnitureLabel') setFurniture((p) => p.map((f) => f.id === id ? { ...f, label: trimmed || f.label } : f));
    setEditingTextAndRef(null);
  };

  // Open the unified inline editor at the exact visual position of the Konva text
  const startEditing = (type: NonNullable<typeof editingText>['type'], id: string, text: string, target: unknown, widthPx: number, style: { fontSize: number; fontFamily: string; fontStyle: string; color: string; align?: string }) => {
    const node = target as Konva.Text;
    const stage = node.getStage();
    if (!stage) return;
    const containerRect = stage.container().getBoundingClientRect();
    // getClientRect gives the actual visual bounding box on the canvas
    const textRect = node.getClientRect({ relativeTo: stage });
    // Use the visual rect position, not getAbsolutePosition (which ignores offset)
    const inputWidth = Math.max(widthPx, textRect.width + 40, 120);
    setEditingTextAndRef({
      type, id, text,
      screenX: textRect.x + containerRect.left,
      screenY: textRect.y + containerRect.top,
      width: inputWidth,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      color: style.color,
      align: style.align ?? 'left',
    });
  };

  // Generate thumbnail: hide text, transparent bg, export, restore
  const generateThumbnail = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !onThumbnailGenerated) return;
    const layers = stage.children;
    if (!layers || layers.length < 4) return;
    // layers: [0]=bg, [1]=shapes, [2]=beds, [3]=labels, [4]=furniture
    const bgLayer = layers[0];
    const labelsLayer = layers[3];
    const furnitureLayer = layers.length > 4 ? layers[4] : null;
    // Hide bg, labels, furniture text
    bgLayer.visible(false);
    labelsLayer.visible(false);
    // Compute content bounds
    const allItems: { x: number; y: number; r: number; b: number }[] = [];
    for (const s of shapes) allItems.push({ x: s.x, y: s.y, r: s.x + s.width, b: s.y + s.depth });
    for (const bp of bedPlacements) {
      const bed = beds.find((b) => b.id === bp.bedId);
      const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
      if (preset) allItems.push({ x: bp.x, y: bp.y, r: bp.x + preset.width, b: bp.y + preset.length });
    }
    for (const f of furniture) allItems.push({ x: f.x, y: f.y, r: f.x + f.width, b: f.y + f.depth });
    if (allItems.length === 0) { bgLayer.visible(true); labelsLayer.visible(true); return; }
    const minX = Math.min(...allItems.map((i) => i.x)) - 0.2;
    const minY = Math.min(...allItems.map((i) => i.y)) - 0.2;
    const maxX = Math.max(...allItems.map((i) => i.r)) + 0.2;
    const maxY = Math.max(...allItems.map((i) => i.b)) + 0.2;
    const sc = BASE_SCALE * zoom;
    const dataUrl = stage.toDataURL({
      mimeType: 'image/webp',
      quality: 0.8,
      x: minX * sc + pan.x,
      y: minY * sc + pan.y,
      width: (maxX - minX) * sc,
      height: (maxY - minY) * sc,
      pixelRatio: 0.5, // half-res for smaller file size
    });
    // Restore
    bgLayer.visible(true);
    labelsLayer.visible(true);
    onThumbnailGenerated(dataUrl.startsWith('data:image/webp') ? dataUrl : stage.toDataURL({ mimeType: 'image/png', quality: 0.8, x: minX * sc + pan.x, y: minY * sc + pan.y, width: (maxX - minX) * sc, height: (maxY - minY) * sc, pixelRatio: 0.5 }));
  }, [shapes, bedPlacements, beds, furniture, zoom, pan, onThumbnailGenerated]);

  // Listen for thumbnail generation request from shell
  useEffect(() => {
    const handler = () => generateThumbnail();
    window.addEventListener('room-builder-generate-thumb', handler);
    return () => window.removeEventListener('room-builder-generate-thumb', handler);
  }, [generateThumbnail]);

  const fmtDim = (m: number) => unit === 'feet' ? `${(m * M_TO_FT).toFixed(1)}ft` : `${m.toFixed(2)}m`;
  const cursor = activeTool === 'rectangle' || activeTool === 'furniture' || activeTool === 'door' || activeTool === 'window' || activeTool === 'arrow' ? 'crosshair' : activeTool === 'text' ? 'text' : panning ? 'grabbing' : 'default';

  return (
    <div ref={containerRef} className="h-full w-full relative" style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
      <Stage ref={stageRef} width={stageSize.width || 1} height={stageSize.height || 1}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

        <Layer listening={false}>
          <Rect name="grid-bg" x={0} y={0} width={stageSize.width || 1} height={stageSize.height || 1} fill={bgColor} />
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
              activeTool={activeTool} stageRef={stageRef} resortConfig={resortConfig}
              editingShapeId={editingText?.type === 'shapeTitle' ? editingText.id : null}
              showTitles={showTitles} showInfo={showInfo}
              startEditing={startEditing}
            />
          ))}
          {drawing && (() => {
            const dx = drawing.current.x * scale + pan.x, dy = drawing.current.y * scale + pan.y;
            const dw = drawing.current.width * scale, dh = drawing.current.depth * scale;
            const ft = (drawing.current as LayoutShape & { _furnitureType?: string })._furnitureType;
            const fp = ft ? FURNITURE_PRESETS.find((p) => p.type === ft) : null;
            const drawShape = fp?.shape;
            const fillColor = ft ? '#f0ebe4' : (SHAPE_FILLS[drawing.current.type] ?? '#f5f5f4');
            return (
              <Group>
                {drawShape === 'circle' ? (
                  <Circle x={dx + dw / 2} y={dy + dh / 2} radius={Math.min(dw, dh) / 2}
                    fill={fillColor} stroke="#3b82f6" strokeWidth={2} dash={[6, 3]} listening={false} />
                ) : drawShape === 'semicircle' ? (
                  <Shape sceneFunc={(ctx, s) => { ctx.beginPath(); ctx.arc(dw / 2, dh, dw / 2, Math.PI, 0); ctx.closePath(); ctx.fillStrokeShape(s); }}
                    x={dx} y={dy} fill={fillColor} stroke="#3b82f6" strokeWidth={2} dash={[6, 3]} listening={false} />
                ) : (
                  <Rect x={dx} y={dy} width={dw} height={dh}
                    fill={fillColor} stroke="#3b82f6" strokeWidth={2} dash={[6, 3]} listening={false} />
                )}
                <Text x={dx + dw + 6} y={dy + dh - 14}
                  text={`${fmtDim(drawing.current.width)} x ${fmtDim(drawing.current.depth)}`}
                  fontSize={12} fill="#3b82f6" fontStyle="bold" listening={false} />
              </Group>
            );
          })()}
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
                onStartRename={(sx, sy, w) => {
                  const bedFontSize = Math.max(9, Math.min(12, w * 0.12));
                  setEditingTextAndRef({ type: 'bedName', id: bp.bedId, text: bed.label, screenX: sx, screenY: sy, width: w, fontSize: bedFontSize, fontFamily: resortConfig.title.fontFamily, fontStyle: 'normal', color: '#57534e', align: 'center' });
                }}
                fontFamily={resortConfig.title.fontFamily}
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
                // Unpair
                if (a.splitKingPairId === idB) return prev.map((p) => (p.id === idA || p.id === idB) ? { ...p, splitKingPairId: null } : p);
                // Pair — snap side-by-side considering rotation
                const aBed = beds.find((bd) => bd.id === a.bedId);
                const aPreset = aBed ? BED_PRESETS.find((p) => p.type === aBed.bedType) : null;
                if (!aPreset) return prev;
                const rad = (a.rotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                // Determine which bed is "first" along the width direction
                const dx = b.x - a.x, dy = b.y - a.y;
                const projWidth = dx * cos + dy * sin;
                const firstId = projWidth >= 0 ? idA : idB;
                const secondId = projWidth >= 0 ? idB : idA;
                const first = projWidth >= 0 ? a : b;
                // Snap second bed to be exactly width-apart along the rotated width direction
                const snapX = first.x + aPreset.width * cos;
                const snapY = first.y + aPreset.width * sin;
                return prev.map((p) => {
                  if (p.id === firstId) return { ...p, splitKingPairId: secondId };
                  if (p.id === secondId) return { ...p, splitKingPairId: firstId, x: snapX, y: snapY, rotation: first.rotation };
                  return p;
                });
              });
            }}
          />
        </Layer>

        {/* Labels — fontSize in meters, scales with zoom (controlled by showTitles) */}
        <Layer visible={showTitles}>
          {labels.map((label) => {
            const fsPx = label.fontSize * scale;
            const rc = resortConfig.info;
            const isBeingEdited = editingText?.type === 'label' && editingText.id === label.id;
            const lx = label.x * scale + pan.x, ly = label.y * scale + pan.y;
            return (
              <Group key={label.id} x={lx} y={ly}
                draggable={activeTool === 'select' && !isBeingEdited}
                onClick={() => setSelectedId(label.id)}
                onDragEnd={(e) => {
                  setLabels((p) => p.map((l) => (l.id === label.id ? { ...l, x: (e.target.x() - pan.x) / scale, y: (e.target.y() - pan.y) / scale } : l)));
                }}
              >
                {/* Background container — measured to fit text */}
                {label.text && !isBeingEdited && (
                  <Rect x={-3} y={-2} width={measureText(label.text, fsPx, rc.fontFamily, rc.fontStyle) + 6} height={fsPx * 1.3 + 4}
                    fill={bgColor} cornerRadius={4} listening={false} />
                )}
                <Text x={0} y={0}
                  text={label.text || 'Add text...'} fontSize={fsPx}
                  fontFamily={rc.fontFamily} fill={label.text ? rc.color : '#d4d4d8'}
                  fontStyle={label.text ? rc.fontStyle : 'italic'}
                  visible={!isBeingEdited}
                  onDblClick={(e) => startEditing('label', label.id, label.text, e.target, Math.max(120, fsPx * 10),
                    { fontSize: fsPx, fontFamily: rc.fontFamily, fontStyle: rc.fontStyle, color: rc.color })}
                />
              </Group>
            );
          })}
        </Layer>

        {/* Furniture */}
        <Layer>
          {furniture.map((item) => {
            const fw = item.width * scale, fd = item.depth * scale;
            const fx = item.x * scale + pan.x, fy = item.y * scale + pan.y;
            const isSel = selectedId === item.id;
            const rc = resortConfig.furniture;
            const isCircle = item.shape === 'circle';
            const isSemiCircle = item.shape === 'semicircle';
            return (
              <Group key={item.id} x={fx} y={fy} rotation={item.rotation}
                draggable={activeTool === 'select'}
                onClick={(e) => { e.cancelBubble = true; setSelectedId(item.id); }}
                onDblClick={(e) => { e.cancelBubble = true;
                  // Toggle resize mode with Transformer
                  setResizingFurnitureId(resizingFurnitureId === item.id ? null : item.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  const wVal = unit === 'feet' ? (item.width * M_TO_FT).toFixed(1) : item.width.toFixed(2);
                  const dVal = unit === 'feet' ? (item.depth * M_TO_FT).toFixed(1) : item.depth.toFixed(2);
                  setFurnitureSizeModal({ id: item.id, width: wVal, depth: dVal });
                }}
                onDragEnd={(e) => {
                  const nx = (e.target.x() - pan.x) / scale, ny = (e.target.y() - pan.y) / scale;
                  const snapped = snapBedInsideWalls(nx, ny, item.width, item.depth);
                  setFurniture((p) => p.map((f) => f.id === item.id ? { ...f, x: snapped.x, y: snapped.y } : f));
                }}
              >
                {isCircle ? (
                  <Circle x={fw / 2} y={fd / 2} radius={Math.min(fw, fd) / 2}
                    ref={resizingFurnitureId === item.id ? furnitureNodeRef as React.RefObject<Konva.Circle> : undefined}
                    fill="#f0ebe4" stroke={resizingFurnitureId === item.id ? '#3b82f6' : (isSel ? '#3b82f6' : '#c4b5a0')}
                    strokeWidth={resizingFurnitureId === item.id ? 2 : (isSel ? 1.5 : 0.5)} />
                ) : isSemiCircle ? (
                  <Shape
                    sceneFunc={(ctx, shape) => {
                      ctx.beginPath();
                      ctx.arc(fw / 2, fd, fw / 2, Math.PI, 0);
                      ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                    fill="#f0ebe4"
                    stroke={resizingFurnitureId === item.id ? '#3b82f6' : (isSel ? '#3b82f6' : '#c4b5a0')}
                    strokeWidth={resizingFurnitureId === item.id ? 2 : (isSel ? 1.5 : 0.5)}
                  />
                ) : (
                  <Rect x={0} y={0} width={fw} height={fd}
                    ref={resizingFurnitureId === item.id ? furnitureNodeRef as React.RefObject<Konva.Rect> : undefined}
                    fill="#f0ebe4" stroke={resizingFurnitureId === item.id ? '#3b82f6' : (isSel ? '#3b82f6' : '#c4b5a0')}
                    strokeWidth={resizingFurnitureId === item.id ? 2 : (isSel ? 1.5 : 0.5)} cornerRadius={2} />
                )}
                {/* Text along longest dimension, never upside down */}
                {(() => {
                  const textAlongLong = item.depth > item.width && !isCircle;
                  // Local rotation for text: 0 if horizontal, -90 if running along depth
                  const localRot = textAlongLong ? -90 : 0;
                  // Total visual angle of text
                  const totalAngle = ((item.rotation ?? 0) + localRot + 360) % 360;
                  // If upside down (between 91° and 269°), flip 180°
                  const flip = totalAngle > 90 && totalAngle < 270 ? 180 : 0;
                  const textRot = localRot + flip;
                  const textW = textAlongLong ? fd : fw;
                  const textH = textAlongLong ? fw : fd;
                  const isVis = !(editingText?.type === 'furnitureLabel' && editingText.id === item.id) && Math.max(fw, fd) > 35 && Math.min(fw, fd) > 12;
                  return (
                    <Text
                      x={fw / 2} y={fd / 2}
                      offsetX={textW / 2} offsetY={(rc.fontSize * scale) / 2}
                      rotation={textRot}
                      width={textW} text={item.label}
                      fontSize={rc.fontSize * scale} fontFamily={rc.fontFamily}
                      fontStyle={rc.fontStyle} fill={rc.color} align="center"
                      visible={isVis}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        startEditing('furnitureLabel', item.id, item.label, e.target as unknown as Parameters<typeof startEditing>[3], textW,
                          { fontSize: rc.fontSize * scale, fontFamily: rc.fontFamily, fontStyle: rc.fontStyle, color: rc.color, align: 'center' });
                      }}
                    />
                  );
                })()}
              </Group>
            );
          })}
          {/* Transformer for furniture resize */}
          {resizingFurnitureId && (
            <Transformer
              ref={furnitureTransformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              borderStroke="#3b82f6"
              borderStrokeWidth={1}
              anchorFill="#3b82f6"
              anchorStroke="#ffffff"
              anchorSize={6}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
              boundBoxFunc={(_old, newBox) => (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) ? _old : newBox}
              onTransformEnd={() => {
                const node = furnitureNodeRef.current;
                if (!node) return;
                const scX = node.scaleX(), scY = node.scaleY();
                node.scaleX(1); node.scaleY(1);
                const item = furniture.find((f) => f.id === resizingFurnitureId);
                if (item) {
                  const newW = Math.max(0.05, item.width * scX);
                  const newD = Math.max(0.05, item.depth * scY);
                  // Capture position shift from transform (corner/edge resize moves the node)
                  const parent = node.getParent();
                  const groupX = parent ? parent.x() : 0;
                  const groupY = parent ? parent.y() : 0;
                  const newX = (groupX + node.x() - pan.x) / scale;
                  const newY = (groupY + node.y() - pan.y) / scale;
                  node.x(0); node.y(0); // reset node offset within group
                  setFurniture((p) => p.map((f) => f.id === resizingFurnitureId ? { ...f, x: newX, y: newY, width: newW, depth: newD } : f));
                }
                setResizingFurnitureId(null);
              }}
            />
          )}
        </Layer>

        {/* Openings (doors + windows) — above all room layers */}
        <Layer>
          {openings.map((op) => {
            const sx1 = op.x1 * scale + pan.x, sy1 = op.y1 * scale + pan.y;
            const sx2 = op.x2 * scale + pan.x, sy2 = op.y2 * scale + pan.y;
            const isSel = selectedId === op.id;
            const isDoor = op.type === 'door';
            const wallPx = WALL_THICKNESS_M * scale;
            const color = isDoor ? DOOR_COLOR : WINDOW_COLOR;
            const dx = sx2 - sx1, dy = sy2 - sy1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const nx = -dy / len, ny = dx / len;
            const hw = wallPx / 2;
            return (
              <Group key={op.id}>
                {/* Main opening shape — not draggable, click to select */}
                <Line
                  points={[sx1 + nx * hw, sy1 + ny * hw, sx2 + nx * hw, sy2 + ny * hw, sx2 - nx * hw, sy2 - ny * hw, sx1 - nx * hw, sy1 - ny * hw]}
                  closed fill={color}
                  stroke={isSel ? '#3b82f6' : 'transparent'}
                  strokeWidth={isSel ? 1 : 0}
                  onClick={(e) => { e.cancelBubble = true; setSelectedId(op.id); }}
                />
                {/* Door endcaps — perpendicular lines at each end, extend slightly beyond wall */}
                {isDoor && (
                  <>
                    <Line points={[sx1 + nx * (hw + 2), sy1 + ny * (hw + 2), sx1 - nx * (hw + 2), sy1 - ny * (hw + 2)]} stroke={WALL_COLOR} strokeWidth={3} lineCap="round" />
                    <Line points={[sx2 + nx * (hw + 2), sy2 + ny * (hw + 2), sx2 - nx * (hw + 2), sy2 - ny * (hw + 2)]} stroke={WALL_COLOR} strokeWidth={3} lineCap="round" />
                  </>
                )}
                {/* Endpoint adjustment dots (dark blue, only when selected) */}
                {isSel && (
                  <>
                    <Circle x={sx1} y={sy1} radius={5} fill="#1e3a5f" stroke="#ffffff" strokeWidth={1}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
                      onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
                      dragBoundFunc={(pos) => {
                        // Constrain to the wall segment
                        if (op.wallX1 !== undefined && op.wallY1 !== undefined && op.wallX2 !== undefined && op.wallY2 !== undefined) {
                          const proj = projectOntoSegment((pos.x - pan.x) / scale, (pos.y - pan.y) / scale, { x1: op.wallX1, y1: op.wallY1, x2: op.wallX2, y2: op.wallY2 });
                          return { x: proj.x * scale + pan.x, y: proj.y * scale + pan.y };
                        }
                        return pos;
                      }}
                      onDragEnd={(e) => {
                        const nx1 = (e.target.x() - pan.x) / scale, ny1 = (e.target.y() - pan.y) / scale;
                        setOpenings((p) => p.map((o) => o.id === op.id ? { ...o, x1: nx1, y1: ny1 } : o));
                      }}
                    />
                    <Circle x={sx2} y={sy2} radius={5} fill="#1e3a5f" stroke="#ffffff" strokeWidth={1}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
                      onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
                      dragBoundFunc={(pos) => {
                        if (op.wallX1 !== undefined && op.wallY1 !== undefined && op.wallX2 !== undefined && op.wallY2 !== undefined) {
                          const proj = projectOntoSegment((pos.x - pan.x) / scale, (pos.y - pan.y) / scale, { x1: op.wallX1, y1: op.wallY1, x2: op.wallX2, y2: op.wallY2 });
                          return { x: proj.x * scale + pan.x, y: proj.y * scale + pan.y };
                        }
                        return pos;
                      }}
                      onDragEnd={(e) => {
                        const nx2 = (e.target.x() - pan.x) / scale, ny2 = (e.target.y() - pan.y) / scale;
                        setOpenings((p) => p.map((o) => o.id === op.id ? { ...o, x2: nx2, y2: ny2 } : o));
                      }}
                    />
                  </>
                )}
              </Group>
            );
          })}
          {/* Drawing preview for door/window — shows in final color */}
          {drawingOpening && (() => {
            const sx1 = drawingOpening.x1 * scale + pan.x, sy1 = drawingOpening.y1 * scale + pan.y;
            const sx2 = drawingOpening.x2 * scale + pan.x, sy2 = drawingOpening.y2 * scale + pan.y;
            const color = drawingOpening.type === 'door' ? DOOR_COLOR : WINDOW_COLOR;
            const wallPx = WALL_THICKNESS_M * scale;
            const dx = sx2 - sx1, dy = sy2 - sy1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const nx = -dy / len * wallPx / 2, ny = dx / len * wallPx / 2;
            return (
              <Group listening={false}>
                <Line points={[sx1 + nx, sy1 + ny, sx2 + nx, sy2 + ny, sx2 - nx, sy2 - ny, sx1 - nx, sy1 - ny]}
                  closed fill={color} />
                {drawingOpening.type === 'door' && (
                  <>
                    <Line points={[sx1 + nx, sy1 + ny, sx1 - nx, sy1 - ny]} stroke={WALL_COLOR} strokeWidth={2} />
                    <Line points={[sx2 + nx, sy2 + ny, sx2 - nx, sy2 - ny]} stroke={WALL_COLOR} strokeWidth={2} />
                  </>
                )}
              </Group>
            );
          })()}

          {/* Arrows */}
          {arrows.map((ar) => {
            const ax1 = ar.x1 * scale + pan.x, ay1 = ar.y1 * scale + pan.y;
            const ax2 = ar.x2 * scale + pan.x, ay2 = ar.y2 * scale + pan.y;
            const adx = ax2 - ax1, ady = ay2 - ay1;
            const alen = Math.sqrt(adx * adx + ady * ady);
            if (alen < 2) return null;
            const isSel = selectedId === ar.id;
            // Arrowhead: two lines from the tip
            const headLen = 12;
            const angle = Math.atan2(ady, adx);
            const h1x = ax2 - headLen * Math.cos(angle - 0.4), h1y = ay2 - headLen * Math.sin(angle - 0.4);
            const h2x = ax2 - headLen * Math.cos(angle + 0.4), h2y = ay2 - headLen * Math.sin(angle + 0.4);
            return (
              <Group key={ar.id} onClick={(e) => { e.cancelBubble = true; setSelectedId(ar.id); }}>
                <Line points={[ax1, ay1, ax2, ay2]} stroke={isSel ? '#3b82f6' : '#44403c'} strokeWidth={3} lineCap="round" />
                <Line points={[h1x, h1y, ax2, ay2, h2x, h2y]} stroke={isSel ? '#3b82f6' : '#44403c'} strokeWidth={3} lineCap="round" lineJoin="round" />
              </Group>
            );
          })}

          {/* Arrow drawing preview */}
          {drawingArrow && (() => {
            const ax1 = drawingArrow.x1 * scale + pan.x, ay1 = drawingArrow.y1 * scale + pan.y;
            const ax2 = drawingArrow.x2 * scale + pan.x, ay2 = drawingArrow.y2 * scale + pan.y;
            const adx = ax2 - ax1, ady = ay2 - ay1;
            const alen = Math.sqrt(adx * adx + ady * ady);
            if (alen < 2) return null;
            const angle = Math.atan2(ady, adx);
            const h1x = ax2 - 12 * Math.cos(angle - 0.4), h1y = ay2 - 12 * Math.sin(angle - 0.4);
            const h2x = ax2 - 12 * Math.cos(angle + 0.4), h2y = ay2 - 12 * Math.sin(angle + 0.4);
            return (
              <Group listening={false}>
                <Line points={[ax1, ay1, ax2, ay2]} stroke="#44403c" strokeWidth={3} lineCap="round" />
                <Line points={[h1x, h1y, ax2, ay2, h2x, h2y]} stroke="#44403c" strokeWidth={3} lineCap="round" lineJoin="round" />
              </Group>
            );
          })()}
        </Layer>
      </Stage>

      {/* Furniture size modal (right-click) */}
      {furnitureSizeModal && (() => {
        const item = furniture.find((f) => f.id === furnitureSizeModal.id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setFurnitureSizeModal(null)}>
            <div className="bg-background border rounded-lg shadow-lg p-4 space-y-3 w-64" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{item?.label ?? 'Resize'}</h4>
                <button onClick={() => setFurnitureSizeModal(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
              </div>
              {/* Dimensions side by side */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input type="text" value={furnitureSizeModal.width}
                    onChange={(e) => setFurnitureSizeModal({ ...furnitureSizeModal, width: e.target.value })}
                    className="w-full rounded border px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Depth ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input type="text" value={furnitureSizeModal.depth}
                    onChange={(e) => setFurnitureSizeModal({ ...furnitureSizeModal, depth: e.target.value })}
                    className="w-full rounded border px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
              </div>
              <button onClick={() => {
                const w = parseFloat(furnitureSizeModal.width), d = parseFloat(furnitureSizeModal.depth);
                if (!isNaN(w) && !isNaN(d) && w > 0 && d > 0) {
                  const wm = unit === 'feet' ? w / M_TO_FT : w;
                  const dm = unit === 'feet' ? d / M_TO_FT : d;
                  setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, width: wm, depth: dm } : f));
                }
                setFurnitureSizeModal(null);
              }} className="w-full rounded bg-primary text-primary-foreground py-1.5 text-xs font-medium hover:opacity-90">Apply</button>
              {/* Rotate buttons (not for circles) */}
              {item?.shape !== 'circle' && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, rotation: ((f.rotation ?? 0) - 15 + 360) % 360 } : f));
                  }} className="flex-1 rounded border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">↶ Rotate -15°</button>
                  <button onClick={() => {
                    setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, rotation: ((f.rotation ?? 0) + 15) % 360 } : f));
                  }} className="flex-1 rounded border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">↷ Rotate +15°</button>
                </div>
              )}
              {/* Duplicate */}
              <button onClick={() => {
                if (!item) return;
                const dup: LayoutFurniture = { ...item, id: generateId(), x: item.x + 0.2, y: item.y + 0.2 };
                setFurniture((p) => [...p, dup]);
                setSelectedId(dup.id);
                setFurnitureSizeModal(null);
              }} className="w-full rounded border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">Duplicate</button>
            </div>
          </div>
        );
      })()}

      {/* ── UNIFIED INLINE TEXT EDITOR ── */}
      {editingText && (
        <input
          type="text"
          className="absolute z-50 outline-none rounded-[5px] border border-primary/30"
          style={{
            left: editingText.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0) - 4,
            top: editingText.screenY - (containerRef.current?.getBoundingClientRect().top ?? 0) - 2,
            width: editingText.width + 8,
            padding: '2px 4px',
            fontSize: editingText.fontSize,
            fontFamily: editingText.fontFamily,
            fontWeight: editingText.fontStyle.includes('bold') ? 'bold' : 'normal',
            fontStyle: editingText.fontStyle.includes('italic') ? 'italic' : 'normal',
            color: editingText.color,
            backgroundColor: 'white',
            textAlign: editingText.align as 'left' | 'center',
            lineHeight: 1.2,
          }}
          value={editingText.text}
          onChange={(e) => {
            const val = e.target.value;
            setEditingTextAndRef((p) => p ? { ...p, text: val } : null);
            // Live update — read type/id from ref (never stale)
            const et = editingTextRef.current;
            if (!et) return;
            if (et.type === 'label') setLabels((p) => p.map((l) => l.id === et.id ? { ...l, text: val } : l));
            if (et.type === 'bedName') setBeds((p) => p.map((b) => b.id === et.id ? { ...b, label: val } : b));
            if (et.type === 'shapeTitle') setShapes((p) => p.map((s) => s.id === et.id ? { ...s, titleText: val } : s));
            if (et.type === 'furnitureLabel') setFurniture((p) => p.map((f) => f.id === et.id ? { ...f, label: val } : f));
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitTextEdit(); }}
          onBlur={commitTextEdit}
          autoFocus
        />
      )}

      {/* Floating display controls — bottom-right, stacked vertically */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 items-end">
        {/* Room thumbnail preview */}
        {thumbnail && (
          <div className="w-24 rounded-lg border bg-background/90 shadow-sm overflow-hidden p-1">
            <img src={thumbnail} alt="Room thumbnail" className="w-full h-auto rounded" style={{ imageRendering: 'auto' }} />
          </div>
        )}
        <button
          onClick={() => setShowTitles(!showTitles)}
          className={`flex items-center justify-center w-24 h-8 rounded-lg border text-[10px] font-medium shadow-sm transition-colors ${showTitles ? 'bg-background/90 text-foreground' : 'bg-muted/60 text-muted-foreground'}`}
        >
          {showTitles ? 'Hide' : 'Show'} Titles
        </button>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`flex items-center justify-center w-24 h-8 rounded-lg border text-[10px] font-medium shadow-sm transition-colors ${showInfo ? 'bg-background/90 text-foreground' : 'bg-muted/60 text-muted-foreground'}`}
        >
          {showInfo ? 'Hide' : 'Show'} Info
        </button>
        <div className="flex items-center justify-between w-24 h-8 rounded-lg border bg-background/90 shadow-sm px-2">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-medium text-muted-foreground">BG</span>
            <span className="text-[10px] font-medium text-muted-foreground">Color</span>
          </div>
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
            className="w-5 h-5 rounded border cursor-pointer" />
        </div>
      </div>
    </div>
  );
}
