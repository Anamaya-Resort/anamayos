'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Shape, Circle } from 'react-konva';
import {
  BED_PRESETS, BASE_SCALE, DEFAULT_RESORT_CONFIG,
  type LayoutJson, type LayoutBedPlacement, type LayoutUnit, type ResortConfig, type TextStyle,
} from './types';

/** Occupancy info per bed */
export interface BedOccupancy {
  bedId: string;
  guestName: string;
}

interface LayoutViewerProps {
  layoutJson: LayoutJson;
  unit: LayoutUnit;
  beds: Array<{ id: string; label: string; bedType: string; capacity: number }>;
  occupancy?: BedOccupancy[];
  onBedClick?: (bedId: string) => void;
  selectedBedId?: string | null;
}

// Colors
const SHAPE_FILLS: Record<string, string> = { room: '#f5f5f4', bathroom: '#e0f2fe', deck: '#f5efe6', loft: '#fef3c7' };
const SHAPE_STROKES: Record<string, string> = { room: '#78716c', bathroom: '#7dd3fc', deck: '#c4a882', loft: '#fcd34d' };
const WALL_COLOR = '#A35B4E';
const WALL_THICKNESS_M = 0.15;
const BED_FILL = '#fafaf9';
const BED_OCCUPIED = '#f1f5f9';
const BED_STROKE = '#78716c';
const BED_SELECTED_STROKE = '#3b82f6';
const PILLOW_FILL = '#f5f5f4';
const PILLOW_STROKE = '#a8a29e';

function parseWallCurve(val: unknown): { offset: number; along: number } {
  if (!val) return { offset: 0, along: 0.5 };
  if (typeof val === 'number') return { offset: val, along: 0.5 };
  const v = val as { offset: number; along: number };
  return { offset: v.offset ?? 0, along: v.along ?? 0.5 };
}

function traceShapePath(ctx: CanvasRenderingContext2D, sw: number, sh: number, curves: Record<string, unknown> | undefined, scale: number) {
  const top = parseWallCurve(curves?.top), right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom), left = parseWallCurve(curves?.left);
  ctx.beginPath(); ctx.moveTo(0, 0);
  if (top.offset) ctx.quadraticCurveTo(sw * top.along, -top.offset * scale, sw, 0); else ctx.lineTo(sw, 0);
  if (right.offset) ctx.quadraticCurveTo(sw + right.offset * scale, sh * right.along, sw, sh); else ctx.lineTo(sw, sh);
  if (bottom.offset) ctx.quadraticCurveTo(sw * (1 - bottom.along), sh + bottom.offset * scale, 0, sh); else ctx.lineTo(0, sh);
  if (left.offset) ctx.quadraticCurveTo(-left.offset * scale, sh * (1 - left.along), 0, 0); else ctx.lineTo(0, 0);
  ctx.closePath();
}

function traceInnerPath(ctx: CanvasRenderingContext2D, sw: number, sh: number, curves: Record<string, unknown> | undefined, scale: number, w: number) {
  const top = parseWallCurve(curves?.top), right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom), left = parseWallCurve(curves?.left);
  ctx.moveTo(w, w);
  if (left.offset) ctx.quadraticCurveTo(-left.offset * scale + w, (sh - 2 * w) * (1 - left.along) + w, w, sh - w); else ctx.lineTo(w, sh - w);
  if (bottom.offset) ctx.quadraticCurveTo((sw - 2 * w) * (1 - bottom.along) + w, sh + bottom.offset * scale - w, sw - w, sh - w); else ctx.lineTo(sw - w, sh - w);
  if (right.offset) ctx.quadraticCurveTo(sw + right.offset * scale - w, (sh - 2 * w) * right.along + w, sw - w, w); else ctx.lineTo(sw - w, w);
  if (top.offset) ctx.quadraticCurveTo((sw - 2 * w) * top.along + w, -top.offset * scale + w, w, w); else ctx.lineTo(w, w);
  ctx.closePath();
}

export function LayoutViewer({ layoutJson, unit, beds, occupancy = [], onBedClick, selectedBedId }: LayoutViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setSize({ width, height: Math.max(200, Math.min(width * 0.65, 500)) });
    });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const allShapes = layoutJson.shapes ?? [];
  const allBeds = layoutJson.beds ?? [];
  const allLabels = layoutJson.labels ?? [];
  const allFurniture = layoutJson.furniture ?? [];
  const rc: ResortConfig = { ...DEFAULT_RESORT_CONFIG, ...(layoutJson.resortConfig ?? {}) } as ResortConfig;

  if (allShapes.length === 0 && allBeds.length === 0) return null;
  if (size.width === 0) return <div ref={containerRef} className="w-full" style={{ minHeight: 100 }} />;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of allShapes) { minX = Math.min(minX, s.x); minY = Math.min(minY, s.y); maxX = Math.max(maxX, s.x + s.width); maxY = Math.max(maxY, s.y + s.depth); }
  for (const bp of allBeds) {
    const bed = beds.find((b) => b.id === bp.bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (preset) { minX = Math.min(minX, bp.x); minY = Math.min(minY, bp.y); maxX = Math.max(maxX, bp.x + preset.width); maxY = Math.max(maxY, bp.y + preset.length); }
  }
  for (const f of allFurniture) { minX = Math.min(minX, f.x); minY = Math.min(minY, f.y); maxX = Math.max(maxX, f.x + f.width); maxY = Math.max(maxY, f.y + f.depth); }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 5; maxY = 5; }

  const PAD = 0.3;
  const layoutW = maxX - minX + PAD * 2, layoutH = maxY - minY + PAD * 2;
  const scale = Math.min((size.width - 20) / layoutW, (size.height - 20) / layoutH, BASE_SCALE * 2);
  const offsetX = (size.width - layoutW * scale) / 2 - (minX - PAD) * scale;
  const offsetY = (size.height - layoutH * scale) / 2 - (minY - PAD) * scale;

  const occupancyMap = new Map(occupancy.map((o) => [o.bedId, o.guestName]));
  const titleStyle: TextStyle = typeof rc.title === 'object' ? rc.title : DEFAULT_RESORT_CONFIG.title;
  const furnitureStyle: TextStyle = typeof rc.furniture === 'object' ? rc.furniture : DEFAULT_RESORT_CONFIG.furniture;

  return (
    <div ref={containerRef} className="w-full">
      <Stage width={size.width || 1} height={size.height || 1}>
        <Layer listening={false}>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="#ffffff" />
        </Layer>

        {/* Shapes with wall thickness */}
        <Layer listening={false}>
          {allShapes.map((shape) => {
            const sw = shape.width * scale, sh = shape.depth * scale;
            const sx = shape.x * scale + offsetX, sy = shape.y * scale + offsetY;
            return (
              <Group key={shape.id} x={sx} y={sy}>
                {/* Fill */}
                <Rect x={0} y={0} width={sw} height={sh} fill={SHAPE_FILLS[shape.type] ?? '#f5f5f4'} />
                {/* Wall band */}
                <Shape
                  sceneFunc={(ctx) => {
                    const nativeCtx = ctx._context;
                    traceShapePath(nativeCtx, sw, sh, shape.wallCurves as Record<string, unknown>, scale);
                    const wallPx = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) * scale;
                    traceInnerPath(nativeCtx, sw, sh, shape.wallCurves as Record<string, unknown>, scale, wallPx);
                    nativeCtx.fillStyle = shape.type === 'loft' ? 'rgba(163,91,78,0.5)' : WALL_COLOR;
                    nativeCtx.fill('evenodd');
                  }}
                />
                {/* Border for curves */}
                <Shape
                  sceneFunc={(ctx, konvaShape) => {
                    traceShapePath(ctx._context, sw, sh, shape.wallCurves as Record<string, unknown>, scale);
                    ctx.fillStrokeShape(konvaShape);
                  }}
                  stroke={SHAPE_STROKES[shape.type] ?? '#78716c'}
                  strokeWidth={1}
                  dash={shape.type === 'loft' ? [6, 4] : undefined}
                />
                {/* Type label — outside bottom-right, above title */}
                <Text x={sw + 3} y={sh - 8} text={shape.type.charAt(0).toUpperCase() + shape.type.slice(1)} fontSize={9} fill="#a1a1aa" />
                {/* Title text */}
                {shape.titleText && (
                  <Text
                    x={(shape.titleOffsetX ?? 0) * sw + sw / 2}
                    y={(shape.titleOffsetY ?? 0) * sh + sh / 2}
                    offsetX={sw / 4}
                    width={sw / 2}
                    text={shape.titleText}
                    fontSize={titleStyle.fontSize * scale}
                    fontFamily={titleStyle.fontFamily}
                    fontStyle={titleStyle.fontStyle}
                    fill={titleStyle.color}
                    align="center"
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Beds — center-based rotation */}
        <Layer>
          {allBeds.map((bp) => {
            const bed = beds.find((b) => b.id === bp.bedId);
            if (!bed) return null;
            const preset = BED_PRESETS.find((p) => p.type === bed.bedType);
            if (!preset) return null;
            const isOccupied = occupancyMap.has(bp.bedId);
            const guestName = occupancyMap.get(bp.bedId);
            const isSelected = selectedBedId === bp.bedId;
            const w = preset.width * scale, h = preset.length * scale;
            const cx = bp.x * scale + offsetX + w / 2, cy = bp.y * scale + offsetY + h / 2;
            const pillowH = Math.min(h * 0.15, 0.25 * scale) * 1.3;
            const pillowPad = w * 0.06;
            const pillowWBase = preset.pillows === 2 ? (w - pillowPad * 3) / 2 : w - pillowPad * 2;
            const pillowW = pillowWBase * 0.8;
            const pOff1 = pillowPad + (pillowWBase - pillowW) / 2;
            const pOff2 = pillowPad * 2 + pillowWBase + (pillowWBase - pillowW) / 2;
            const pillowRadius = Math.min(pillowW * 0.2, pillowH * 0.3);

            return (
              <Group key={bp.id} x={cx} y={cy} offsetX={w / 2} offsetY={h / 2} rotation={bp.rotation}
                onClick={() => onBedClick?.(bp.bedId)} onTap={() => onBedClick?.(bp.bedId)}
                onMouseEnter={(e) => { if (onBedClick) e.target.getStage()!.container().style.cursor = 'pointer'; }}
                onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
              >
                <Rect width={w} height={h} fill={isOccupied ? BED_OCCUPIED : BED_FILL}
                  stroke={isSelected ? BED_SELECTED_STROKE : BED_STROKE} strokeWidth={isSelected ? 2 : 1} cornerRadius={2} />
                {preset.pillows >= 1 && <Rect x={pOff1} y={pillowPad} width={pillowW} height={pillowH}
                  fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />}
                {preset.pillows === 2 && <Rect x={pOff2} y={pillowPad} width={pillowW} height={pillowH}
                  fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />}
                <Text x={0} y={isOccupied ? h * 0.3 : h / 2 - 6} width={w} text={bed.label}
                  fontSize={Math.max(8, Math.min(11, w * 0.1))} fill="#57534e" align="center" />
                {isOccupied && guestName && (
                  <Text x={0} y={h * 0.5} width={w} text={`Occupied: ${guestName}`}
                    fontSize={Math.max(7, Math.min(9, w * 0.08))} fill="#94a3b8" align="center" fontStyle="italic" />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Furniture */}
        <Layer listening={false}>
          {allFurniture.map((item) => {
            const fw = item.width * scale, fd = item.depth * scale;
            const isCircle = item.shape === 'circle';
            return (
              <Group key={item.id} x={item.x * scale + offsetX} y={item.y * scale + offsetY} rotation={item.rotation}>
                {isCircle ? (
                  <Circle x={fw / 2} y={fd / 2} radius={Math.min(fw, fd) / 2} fill="#f0ebe4" stroke="#c4b5a0" strokeWidth={0.5} />
                ) : (
                  <Rect width={fw} height={fd} fill="#f0ebe4" stroke="#c4b5a0" strokeWidth={0.5} cornerRadius={2} />
                )}
                <Text x={0} y={fd / 2 - (furnitureStyle.fontSize * scale) / 2} width={fw} text={item.label}
                  fontSize={furnitureStyle.fontSize * scale} fontFamily={furnitureStyle.fontFamily}
                  fontStyle={furnitureStyle.fontStyle} fill={furnitureStyle.color} align="center" />
              </Group>
            );
          })}
        </Layer>

        {/* Labels */}
        <Layer listening={false}>
          {allLabels.map((label) => (
            <Text key={label.id} x={label.x * scale + offsetX} y={label.y * scale + offsetY}
              text={label.text} fontSize={label.fontSize * scale} fill="#44403c" rotation={label.rotation} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
