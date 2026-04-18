'use client';

import React, { useEffect, useRef } from 'react';
import { Group, Rect, Line, Circle, Transformer, Shape } from 'react-konva';
import type Konva from 'konva';
import { parseWallCurve, traceShapePath, traceInnerPath, traceInnerPathStandalone } from './path-utils';
import {
  BED_PRESETS, M_TO_FT,
  type LayoutShape, type LayoutBedPlacement, type LayoutUnit,
} from './types';
import type { RoomBed, ActiveTool } from './room-builder-shell';
import {
  SELECT_COLOR, SUCCESS_COLOR, WALL_COLOR, WALL_THICKNESS_M,
  GRID_MAJOR, GRID_MINOR, SHAPE_FILLS, CANVAS_BG,
} from './colors';

interface RoomShapeProps {
  shape: LayoutShape;
  scale: number;
  panX: number;
  panY: number;
  unit: LayoutUnit;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onShapeChange: (updates: Partial<LayoutShape>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  beds: RoomBed[];
  bedPlacements: LayoutBedPlacement[];
  setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>>;
  activeTool: ActiveTool;
  wallColor?: string;
}

export function RoomShape({
  shape, scale, panX, panY, unit, isSelected, isHovered,
  onSelect, onShapeChange, onMouseEnter, onMouseLeave,
  beds, bedPlacements, setBedPlacements,
  activeTool, wallColor,
}: RoomShapeProps) {
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const gridGroupRef = useRef<Konva.Group>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const sw = shape.width * scale;
  const sh = shape.depth * scale;
  const sx = shape.x * scale + panX;
  const sy = shape.y * scale + panY;
  const showHandles = isSelected || isHovered;

  useEffect(() => {
    if (isSelected && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const fmtDim = (m: number) => unit === 'feet' ? `${(m * M_TO_FT).toFixed(1)}ft` : `${m.toFixed(2)}m`;

  // Grid lines
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

  return (
    <>
      <Group
        x={sx} y={sy}
        draggable={activeTool === 'select'}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={() => { if (activeTool === 'select') onSelect(); }}
        onTap={() => { if (activeTool === 'select') onSelect(); }}
        onDragStart={() => { dragStartPos.current = { x: sx, y: sy }; }}
        onDragMove={() => {}}
        onDragEnd={(e) => {
          if (!dragStartPos.current) return;
          const newX = (e.target.x() - panX) / scale;
          const newY = (e.target.y() - panY) / scale;
          const dx = newX - shape.x, dy = newY - shape.y;
          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
            onShapeChange({ x: newX, y: newY });
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
        {/* Fill + grid clipped to inner wall path */}
        <Group ref={gridGroupRef} clipFunc={(ctx) => {
          const wallPx = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) * scale;
          traceInnerPathStandalone(ctx, sw, sh, shape.wallCurves, scale, wallPx, shape.geometry);
        }} listening={false}>
          <Rect x={-sw} y={-sh} width={sw * 3} height={sh * 3} fill={SHAPE_FILLS[shape.type]} />
          {gridLines}
          {(() => {
            const extra: React.ReactNode[] = [];
            const step = unit === 'meters' ? 1.0 : 0.3048;
            const ext = 2 * scale;
            for (let x = Math.ceil((shape.x - 2) / step) * step; x < shape.x; x += step)
              extra.push(<Line key={`ex-v${x.toFixed(4)}`} points={[(x - shape.x) * scale, -ext, (x - shape.x) * scale, sh + ext]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            for (let x = shape.x + shape.width; x < shape.x + shape.width + 2; x += step)
              extra.push(<Line key={`ex-v${x.toFixed(4)}`} points={[(x - shape.x) * scale, -ext, (x - shape.x) * scale, sh + ext]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            for (let y = Math.ceil((shape.y - 2) / step) * step; y < shape.y; y += step)
              extra.push(<Line key={`ex-h${y.toFixed(4)}`} points={[-ext, (y - shape.y) * scale, sw + ext, (y - shape.y) * scale]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            for (let y = shape.y + shape.depth; y < shape.y + shape.depth + 2; y += step)
              extra.push(<Line key={`ex-h${y.toFixed(4)}`} points={[-ext, (y - shape.y) * scale, sw + ext, (y - shape.y) * scale]} stroke={GRID_MAJOR} strokeWidth={1} listening={false} />);
            return extra;
          })()}
        </Group>

        {/* Invisible Rect for Transformer */}
        <Rect
          ref={rectRef}
          x={0} y={0} width={sw} height={sh}
          fill="transparent" stroke="transparent" strokeWidth={0}
          onTransform={() => {
            const node = rectRef.current, grid = gridGroupRef.current;
            if (!node || !grid) return;
            grid.scaleX(node.scaleX()); grid.scaleY(node.scaleY());
            grid.x(node.x()); grid.y(node.y());
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
            const grid = gridGroupRef.current;
            if (grid) { grid.scaleX(1); grid.scaleY(1); grid.x(0); grid.y(0); }
            onShapeChange({ x: newX, y: newY, width: newW, depth: newH });
          }}
        />

        {/* Walls */}
        <Shape
          sceneFunc={(ctx) => {
            const wallPx = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) * scale;
            const nativeCtx = ctx._context;
            traceShapePath(nativeCtx, sw, sh, shape.wallCurves, scale, shape.geometry);
            traceInnerPath(nativeCtx, sw, sh, shape.wallCurves, scale, wallPx, shape.geometry);
            nativeCtx.fillStyle = isSelected ? SELECT_COLOR : (wallColor ?? WALL_COLOR);
            nativeCtx.globalAlpha = shape.type === 'loft' ? 0.5 : 1;
            nativeCtx.fill('evenodd');
            nativeCtx.globalAlpha = 1;
          }}
          listening={false}
        />
        {isSelected && (
          <Shape
            sceneFunc={(ctx, konvaShape) => {
              traceShapePath(ctx, sw, sh, shape.wallCurves, scale, shape.geometry);
              ctx.fillStrokeShape(konvaShape);
            }}
            stroke={SELECT_COLOR} strokeWidth={2} listening={false}
          />
        )}
      </Group>

      {/* Transformer (rectangles only) */}
      {showHandles && isSelected && (!shape.geometry || shape.geometry === 'rectangle') && (
        <Transformer
          ref={trRef}
          flipEnabled={false} rotateEnabled={false} keepRatio={false}
          borderStroke="transparent" borderStrokeWidth={0}
          anchorFill={SELECT_COLOR} anchorStroke={CANVAS_BG}
          anchorSize={8} anchorCornerRadius={1}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
          boundBoxFunc={(_oldBox, newBox) => {
            if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) return _oldBox;
            return newBox;
          }}
        />
      )}

      {/* Wall arc handles (rectangles only) */}
      {isSelected && (!shape.geometry || shape.geometry === 'rectangle') && ([
        { key: 'top', wallStart: { x: sx, y: sy }, wallEnd: { x: sx + sw, y: sy }, perpAxis: 'y' as const, perpSign: -1 },
        { key: 'bottom', wallStart: { x: sx + sw, y: sy + sh }, wallEnd: { x: sx, y: sy + sh }, perpAxis: 'y' as const, perpSign: 1 },
        { key: 'right', wallStart: { x: sx + sw, y: sy }, wallEnd: { x: sx + sw, y: sy + sh }, perpAxis: 'x' as const, perpSign: 1 },
        { key: 'left', wallStart: { x: sx, y: sy + sh }, wallEnd: { x: sx, y: sy }, perpAxis: 'x' as const, perpSign: -1 },
      ]).map((h) => {
        const wc = parseWallCurve(shape.wallCurves?.[h.key]);
        let hx: number, hy: number;
        if (h.perpAxis === 'y') {
          hx = h.wallStart.x + (h.wallEnd.x - h.wallStart.x) * wc.along;
          hy = h.wallStart.y + wc.offset * scale * h.perpSign;
        } else {
          hx = h.wallStart.x + wc.offset * scale * h.perpSign;
          hy = h.wallStart.y + (h.wallEnd.y - h.wallStart.y) * wc.along;
        }
        return (
          <Circle key={`arc-${h.key}`} x={hx} y={hy} radius={6} fill={SUCCESS_COLOR} opacity={0.8}
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

      {/* Radius handle (circle/semicircle) */}
      {isSelected && (shape.geometry === 'circle' || shape.geometry === 'semicircle') && (() => {
        const geo = shape.geometry;
        const cx = sx + sw / 2, cy = geo === 'semicircle' ? sy + sh : sy + sh / 2;
        const r = geo === 'semicircle' ? Math.min(sw / 2, sh) : Math.min(sw, sh) / 2;
        const hx = cx + r * scale, hy = cy;
        return (
          <Circle x={hx} y={hy} radius={7} fill={SELECT_COLOR} stroke={CANVAS_BG} strokeWidth={1.5}
            draggable
            onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ew-resize'; }}
            onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
            onDragMove={(e) => {
              const newHx = e.target.x();
              const newR = Math.max(0.5, (newHx - (sx + sw / 2)) / scale);
              const diameter = newR * 2;
              if (geo === 'circle') onShapeChange({ width: diameter, depth: diameter });
              else onShapeChange({ width: diameter, depth: newR });
            }}
            onDragEnd={() => {}}
          />
        );
      })()}
    </>
  );
}
