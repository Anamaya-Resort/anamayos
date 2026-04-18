'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Shape, Circle, Line } from 'react-konva';
import {
  BED_PRESETS, BASE_SCALE, DEFAULT_RESORT_CONFIG,
  type LayoutJson, type LayoutBedPlacement, type LayoutShape, type LayoutFurniture, type LayoutOpening, type LayoutArrow, type LayoutUnit, type ResortConfig, type TextStyle,
} from './types';
import {
  SELECT_COLOR, WALL_COLOR, WALL_THICKNESS_M,
  SHAPE_FILLS, SHAPE_STROKES, FURNITURE_FILL, FURNITURE_STROKE,
  BED_FILL, BED_STROKE, PILLOW_FILL, PILLOW_STROKE,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_FAINT,
  DOOR_COLOR, WINDOW_COLOR, CANVAS_BG,
} from './colors';

const BED_OCCUPIED = '#f1f5f9';

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

// ── Path tracing (shared logic with builder-canvas) ──

function parseWallCurve(val: unknown): { offset: number; along: number } {
  if (!val) return { offset: 0, along: 0.5 };
  if (typeof val === 'number') return { offset: val, along: 0.5 };
  const v = val as { offset: number; along: number };
  return { offset: v.offset ?? 0, along: v.along ?? 0.5 };
}

function traceShapePath(ctx: CanvasRenderingContext2D, sw: number, sh: number, curves: Record<string, unknown> | undefined, scale: number, geometry?: string) {
  ctx.beginPath();

  if (geometry === 'circle') {
    const cx = sw / 2, cy = sh / 2, r = Math.min(sw, sh) / 2;
    ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); return;
  }
  if (geometry === 'semicircle') {
    const cx = sw / 2, cy = sh, r = Math.min(sw / 2, sh);
    ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI); ctx.closePath(); return;
  }

  const top = parseWallCurve(curves?.top), right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom), left = parseWallCurve(curves?.left);
  ctx.moveTo(0, 0);
  if (top.offset) ctx.quadraticCurveTo(sw * top.along, -top.offset * scale, sw, 0); else ctx.lineTo(sw, 0);
  if (right.offset) ctx.quadraticCurveTo(sw + right.offset * scale, sh * right.along, sw, sh); else ctx.lineTo(sw, sh);
  if (bottom.offset) ctx.quadraticCurveTo(sw * (1 - bottom.along), sh + bottom.offset * scale, 0, sh); else ctx.lineTo(0, sh);
  if (left.offset) ctx.quadraticCurveTo(-left.offset * scale, sh * (1 - left.along), 0, 0); else ctx.lineTo(0, 0);
  ctx.closePath();
}

function traceInnerPath(ctx: CanvasRenderingContext2D, sw: number, sh: number, curves: Record<string, unknown> | undefined, scale: number, w: number, geometry?: string) {
  if (geometry === 'circle') {
    const cx = sw / 2, cy = sh / 2, r = Math.min(sw, sh) / 2 - w;
    if (r > 0) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); }
    ctx.closePath(); return;
  }
  if (geometry === 'semicircle') {
    const cx = sw / 2, cy = sh, r = Math.min(sw / 2, sh) - w;
    if (r > 0) { ctx.moveTo(cx - r, cy - w); ctx.arc(cx, cy, r, Math.PI, 0, true); ctx.lineTo(cx + r, cy - w); }
    ctx.closePath(); return;
  }

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
  const allOpenings = layoutJson.openings ?? [];
  const allArrows = layoutJson.arrows ?? [];
  const rc: ResortConfig = { ...DEFAULT_RESORT_CONFIG, ...(layoutJson.resortConfig ?? {}) } as ResortConfig;

  if (allShapes.length === 0 && allBeds.length === 0) return null;
  if (size.width === 0) return <div ref={containerRef} className="w-full" style={{ minHeight: 100 }} />;

  // Compute bounding box — must include ALL element types
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of allShapes) { minX = Math.min(minX, s.x); minY = Math.min(minY, s.y); maxX = Math.max(maxX, s.x + s.width); maxY = Math.max(maxY, s.y + s.depth); }
  for (const bp of allBeds) {
    const bed = beds.find((b) => b.id === bp.bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (preset) { minX = Math.min(minX, bp.x); minY = Math.min(minY, bp.y); maxX = Math.max(maxX, bp.x + preset.width); maxY = Math.max(maxY, bp.y + preset.length); }
  }
  for (const f of allFurniture) { minX = Math.min(minX, f.x); minY = Math.min(minY, f.y); maxX = Math.max(maxX, f.x + f.width); maxY = Math.max(maxY, f.y + f.depth); }
  for (const ar of allArrows) { minX = Math.min(minX, ar.x1, ar.x2); minY = Math.min(minY, ar.y1, ar.y2); maxX = Math.max(maxX, ar.x1, ar.x2); maxY = Math.max(maxY, ar.y1, ar.y2); }
  for (const op of allOpenings) { minX = Math.min(minX, op.x1, op.x2); minY = Math.min(minY, op.y1, op.y2); maxX = Math.max(maxX, op.x1, op.x2); maxY = Math.max(maxY, op.y1, op.y2); }
  for (const lb of allLabels) { minX = Math.min(minX, lb.x); minY = Math.min(minY, lb.y); maxX = Math.max(maxX, lb.x + 1); maxY = Math.max(maxY, lb.y + 0.5); }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 5; maxY = 5; }

  const PAD = 0.3;
  const layoutW = maxX - minX + PAD * 2, layoutH = maxY - minY + PAD * 2;
  const scale = Math.min((size.width - 20) / layoutW, (size.height - 20) / layoutH, BASE_SCALE * 2);
  const ox = (size.width - layoutW * scale) / 2 - (minX - PAD) * scale;
  const oy = (size.height - layoutH * scale) / 2 - (minY - PAD) * scale;

  const occupancyMap = new Map(occupancy.map((o) => [o.bedId, o.guestName]));
  const titleStyle: TextStyle = typeof rc.title === 'object' ? rc.title : DEFAULT_RESORT_CONFIG.title;
  const furnitureStyle: TextStyle = typeof rc.furniture === 'object' ? rc.furniture : DEFAULT_RESORT_CONFIG.furniture;

  return (
    <div ref={containerRef} className="w-full">
      <Stage width={size.width || 1} height={size.height || 1}>
        {/* Background */}
        <Layer listening={false}>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={CANVAS_BG} />
        </Layer>

        {/* Shapes with walls */}
        <Layer listening={false}>
          {allShapes.map((shape) => {
            const sw = shape.width * scale, sh = shape.depth * scale;
            const sx = shape.x * scale + ox, sy = shape.y * scale + oy;
            const geo = shape.geometry;
            return (
              <Group key={shape.id} x={sx} y={sy}>
                {/* Fill */}
                <Shape
                  sceneFunc={(ctx, konvaShape) => {
                    traceShapePath(ctx._context, sw, sh, shape.wallCurves as Record<string, unknown>, scale, geo);
                    ctx.fillStrokeShape(konvaShape);
                  }}
                  fill={SHAPE_FILLS[shape.type] ?? '#f5f5f4'}
                />
                {/* Wall band */}
                <Shape
                  sceneFunc={(ctx) => {
                    const nativeCtx = ctx._context;
                    traceShapePath(nativeCtx, sw, sh, shape.wallCurves as Record<string, unknown>, scale, geo);
                    const wallPx = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) * scale;
                    traceInnerPath(nativeCtx, sw, sh, shape.wallCurves as Record<string, unknown>, scale, wallPx, geo);
                    nativeCtx.fillStyle = shape.type === 'loft' ? 'rgba(163,91,78,0.5)' : WALL_COLOR;
                    nativeCtx.fill('evenodd');
                  }}
                />
                {/* Border */}
                <Shape
                  sceneFunc={(ctx, konvaShape) => {
                    traceShapePath(ctx._context, sw, sh, shape.wallCurves as Record<string, unknown>, scale, geo);
                    ctx.fillStrokeShape(konvaShape);
                  }}
                  stroke={SHAPE_STROKES[shape.type] ?? '#78716c'}
                  strokeWidth={1}
                  dash={shape.type === 'loft' ? [6, 4] : undefined}
                />
              </Group>
            );
          })}
        </Layer>

        {/* Openings (doors/windows) */}
        <Layer listening={false}>
          {allOpenings.map((op) => {
            const sx1 = op.x1 * scale + ox, sy1 = op.y1 * scale + oy;
            const sx2 = op.x2 * scale + ox, sy2 = op.y2 * scale + oy;
            const dx = sx2 - sx1, dy = sy2 - sy1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const nx = -dy / len, ny = dx / len;
            const hw = WALL_THICKNESS_M * scale * 0.6;
            const isDoor = op.type === 'door';
            const color = isDoor ? DOOR_COLOR : WINDOW_COLOR;
            return (
              <Group key={op.id}>
                <Line
                  points={[sx1 + nx * hw, sy1 + ny * hw, sx2 + nx * hw, sy2 + ny * hw, sx2 - nx * hw, sy2 - ny * hw, sx1 - nx * hw, sy1 - ny * hw]}
                  closed fill={color}
                />
                {isDoor && (
                  <>
                    <Line points={[sx1 + nx * hw * 1.3, sy1 + ny * hw * 1.3, sx1 - nx * hw * 1.3, sy1 - ny * hw * 1.3]}
                      stroke={color} strokeWidth={1.5} />
                    <Line points={[sx2 + nx * hw * 1.3, sy2 + ny * hw * 1.3, sx2 - nx * hw * 1.3, sy2 - ny * hw * 1.3]}
                      stroke={color} strokeWidth={1.5} />
                  </>
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
            const isSemiCircle = item.shape === 'semicircle';
            const noText = isSemiCircle || item.type === 'nightstand';
            return (
              <Group key={item.id} x={item.x * scale + ox} y={item.y * scale + oy} rotation={item.rotation}>
                {isCircle ? (
                  <Circle x={fw / 2} y={fd / 2} radius={Math.min(fw, fd) / 2} fill={item.color ?? FURNITURE_FILL} stroke={FURNITURE_STROKE} strokeWidth={0.5} />
                ) : isSemiCircle ? (
                  <Shape
                    sceneFunc={(ctx, shape) => {
                      const r = Math.min(fw, fd) / 2;
                      ctx.beginPath(); ctx.arc(fw / 2, fd / 2, r, Math.PI, 0); ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                    fill={item.color ?? FURNITURE_FILL} stroke={FURNITURE_STROKE} strokeWidth={0.5}
                  />
                ) : (
                  <Rect width={fw} height={fd} fill={item.color ?? FURNITURE_FILL} stroke={FURNITURE_STROKE} strokeWidth={0.5} cornerRadius={2} />
                )}
                {!noText && Math.max(fw, fd) > 30 && (
                  <Text x={0} y={fd / 2 - (furnitureStyle.fontSize * scale) / 2} width={fw} text={item.label}
                    fontSize={furnitureStyle.fontSize * scale} fontFamily={furnitureStyle.fontFamily}
                    fontStyle={furnitureStyle.fontStyle} fill={furnitureStyle.color} align="center" />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Beds */}
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
            const cx = bp.x * scale + ox + w / 2, cy = bp.y * scale + oy + h / 2;
            const pillowH = Math.min(h * 0.15, 0.25 * scale) * 1.3;
            const pillowPad = w * 0.06;
            const pillowWBase = preset.pillows === 2 ? (w - pillowPad * 3) / 2 : w - pillowPad * 2;
            const pillowW = pillowWBase * 0.8;
            const pOff1 = pillowPad + (pillowWBase - pillowW) / 2;
            const pOff2 = pillowPad * 2 + pillowWBase + (pillowWBase - pillowW) / 2;
            const pillowRadius = Math.min(pillowW * 0.2, pillowH * 0.3);
            const isBunkTop = bed.bedType === 'bunk_top';

            return (
              <Group key={bp.id} x={cx} y={cy} offsetX={w / 2} offsetY={h / 2} rotation={bp.rotation}
                onClick={() => onBedClick?.(bp.bedId)} onTap={() => onBedClick?.(bp.bedId)}
                onMouseEnter={(e) => { if (onBedClick) e.target.getStage()!.container().style.cursor = 'pointer'; }}
                onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
              >
                <Rect width={w} height={h} fill={isOccupied ? BED_OCCUPIED : BED_FILL}
                  stroke={isSelected ? SELECT_COLOR : BED_STROKE} strokeWidth={isSelected ? 2 : 1} cornerRadius={2}
                  dash={isBunkTop ? [4, 3] : undefined} />
                {preset.pillows >= 1 && <Rect x={pOff1} y={pillowPad} width={pillowW} height={pillowH}
                  fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />}
                {preset.pillows === 2 && <Rect x={pOff2} y={pillowPad} width={pillowW} height={pillowH}
                  fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />}
                <Text x={0} y={isOccupied ? h * 0.3 : h * 0.65 - 6} width={w} text={bed.label}
                  fontSize={Math.max(8, Math.min(11, w * 0.1))} fill={TEXT_SECONDARY} align="center" />
                {isOccupied && guestName && (
                  <Text x={0} y={h * 0.5} width={w} text={guestName}
                    fontSize={Math.max(7, Math.min(9, w * 0.08))} fill={TEXT_MUTED} align="center" fontStyle="italic" />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Labels */}
        <Layer listening={false}>
          {allLabels.map((label) => (
            <Text key={label.id} x={label.x * scale + ox} y={label.y * scale + oy}
              text={label.text} fontSize={label.fontSize * scale} fill={TEXT_PRIMARY} rotation={label.rotation} />
          ))}
        </Layer>

        {/* Arrows */}
        <Layer listening={false}>
          {allArrows.map((ar) => {
            const ax1 = ar.x1 * scale + ox, ay1 = ar.y1 * scale + oy;
            const ax2 = ar.x2 * scale + ox, ay2 = ar.y2 * scale + oy;
            const angle = Math.atan2(ay2 - ay1, ax2 - ax1);
            const headLen = 10;
            const h1x = ax2 - headLen * Math.cos(angle - 0.4), h1y = ay2 - headLen * Math.sin(angle - 0.4);
            const h2x = ax2 - headLen * Math.cos(angle + 0.4), h2y = ay2 - headLen * Math.sin(angle + 0.4);
            return (
              <Group key={ar.id}>
                <Line points={[ax1, ay1, ax2, ay2]} stroke={TEXT_PRIMARY} strokeWidth={2} lineCap="round" />
                <Line points={[h1x, h1y, ax2, ay2, h2x, h2y]} stroke={TEXT_PRIMARY} strokeWidth={2} lineCap="round" lineJoin="round" />
              </Group>
            );
          })}
        </Layer>

        {/* Shape titles (top layer) */}
        <Layer listening={false}>
          {allShapes.map((shape) => {
            if (!shape.titleText) return null;
            const sw = shape.width * scale, sh = shape.depth * scale;
            const sx = shape.x * scale + ox, sy = shape.y * scale + oy;
            const titleFs = titleStyle.fontSize * scale;
            const tx = sx + sw / 2 + (shape.titleOffsetX ?? 0) * sw;
            const ty = sy + sh / 2 + (shape.titleOffsetY ?? 0) * sh;
            return (
              <Text key={`title-${shape.id}`} x={tx} y={ty} offsetX={sw / 4} width={sw / 2}
                text={shape.titleText} fontSize={titleFs}
                fontFamily={titleStyle.fontFamily} fontStyle={titleStyle.fontStyle}
                fill={titleStyle.color} align="center" />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
