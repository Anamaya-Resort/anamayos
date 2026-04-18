'use client';

import React from 'react';
import { Layer, Rect, Group, Text, Shape, Circle, Line } from 'react-konva';
import { traceShapePath, traceInnerPath } from './path-utils';
import {
  BED_PRESETS, DEFAULT_RESORT_CONFIG,
  type LayoutJson, type ResortConfig, type TextStyle,
} from './types';
import {
  WALL_COLOR, WALL_THICKNESS_M,
  SHAPE_FILLS, SHAPE_STROKES, FURNITURE_FILL, FURNITURE_STROKE,
  BED_FILL, BED_STROKE, PILLOW_FILL, PILLOW_STROKE,
  TEXT_PRIMARY, TEXT_SECONDARY,
  DOOR_COLOR, WINDOW_COLOR,
} from './colors';

export interface RoomBaseRendererProps {
  layoutJson: LayoutJson;
  beds: Array<{ id: string; label: string; bedType: string; capacity: number }>;
  scale: number;
  offsetX: number;
  offsetY: number;
  resortConfig?: ResortConfig;
  showLabels?: boolean;
  showTitles?: boolean;
  showArrows?: boolean;
  showOpenings?: boolean;
  children?: React.ReactNode;
}

/**
 * Pure presentational component that renders all static room elements as Konva layers.
 * No state, no drag, no selection. Consumers compose overlays by passing children.
 *
 * Must be rendered inside a Konva <Stage>.
 */
export function RoomBaseRenderer({
  layoutJson, beds, scale, offsetX: ox, offsetY: oy,
  resortConfig,
  showLabels = true, showTitles = true, showArrows = true, showOpenings = true,
  children,
}: RoomBaseRendererProps) {
  const allShapes = layoutJson.shapes ?? [];
  const allBeds = layoutJson.beds ?? [];
  const allLabels = layoutJson.labels ?? [];
  const allFurniture = layoutJson.furniture ?? [];
  const allOpenings = layoutJson.openings ?? [];
  const allArrows = layoutJson.arrows ?? [];
  const rc: ResortConfig = { ...DEFAULT_RESORT_CONFIG, ...(resortConfig ?? {}) } as ResortConfig;
  const titleStyle: TextStyle = typeof rc.title === 'object' ? rc.title : DEFAULT_RESORT_CONFIG.title;
  const furnitureStyle: TextStyle = typeof rc.furniture === 'object' ? rc.furniture : DEFAULT_RESORT_CONFIG.furniture;

  return (
    <>
      {/* Shapes with walls */}
      <Layer listening={false}>
        {allShapes.map((shape) => {
          const sw = shape.width * scale, sh = shape.depth * scale;
          const sx = shape.x * scale + ox, sy = shape.y * scale + oy;
          const geo = shape.geometry;
          return (
            <Group key={shape.id} x={sx} y={sy}>
              <Shape
                sceneFunc={(ctx, konvaShape) => {
                  traceShapePath(ctx._context, sw, sh, shape.wallCurves as Record<string, { offset: number; along: number } | number>, scale, geo);
                  ctx.fillStrokeShape(konvaShape);
                }}
                fill={SHAPE_FILLS[shape.type] ?? SHAPE_FILLS.room}
              />
              <Shape
                sceneFunc={(ctx) => {
                  const nativeCtx = ctx._context;
                  traceShapePath(nativeCtx, sw, sh, shape.wallCurves as Record<string, { offset: number; along: number } | number>, scale, geo);
                  const wallPx = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) * scale;
                  traceInnerPath(nativeCtx, sw, sh, shape.wallCurves as Record<string, { offset: number; along: number } | number>, scale, wallPx, geo);
                  nativeCtx.fillStyle = shape.type === 'loft' ? 'rgba(163,91,78,0.5)' : WALL_COLOR;
                  nativeCtx.fill('evenodd');
                }}
              />
              <Shape
                sceneFunc={(ctx, konvaShape) => {
                  traceShapePath(ctx._context, sw, sh, shape.wallCurves as Record<string, { offset: number; along: number } | number>, scale, geo);
                  ctx.fillStrokeShape(konvaShape);
                }}
                stroke={SHAPE_STROKES[shape.type] ?? SHAPE_STROKES.room}
                strokeWidth={1}
                dash={shape.type === 'loft' ? [6, 4] : undefined}
              />
            </Group>
          );
        })}
      </Layer>

      {/* Openings (doors/windows) */}
      {showOpenings && (
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
                    <Line points={[sx1 + nx * hw * 1.3, sy1 + ny * hw * 1.3, sx1 - nx * hw * 1.3, sy1 - ny * hw * 1.3]} stroke={color} strokeWidth={1.5} />
                    <Line points={[sx2 + nx * hw * 1.3, sy2 + ny * hw * 1.3, sx2 - nx * hw * 1.3, sy2 - ny * hw * 1.3]} stroke={color} strokeWidth={1.5} />
                  </>
                )}
              </Group>
            );
          })}
        </Layer>
      )}

      {/* Furniture */}
      <Layer listening={false}>
        {allFurniture.map((item) => {
          const fw = item.width * scale, fd = item.depth * scale;
          const isCircle = item.shape === 'circle';
          const isSemiCircle = item.shape === 'semicircle';
          const noText = !item.label;
          return (
            <Group key={item.id} x={item.x * scale + ox} y={item.y * scale + oy} rotation={item.rotation}>
              {isCircle ? (
                <Circle x={fw / 2} y={fd / 2} radius={Math.min(fw, fd) / 2} fill={item.color ?? FURNITURE_FILL} stroke={FURNITURE_STROKE} strokeWidth={0.5} />
              ) : isSemiCircle ? (
                <Shape
                  sceneFunc={(ctx, s) => {
                    const r = Math.min(fw, fd) / 2;
                    ctx.beginPath(); ctx.arc(fw / 2, fd / 2, r, Math.PI, 0); ctx.closePath();
                    ctx.fillStrokeShape(s);
                  }}
                  fill={item.color ?? FURNITURE_FILL} stroke={FURNITURE_STROKE} strokeWidth={0.5}
                />
              ) : (
                <Rect width={fw} height={fd} fill={item.color ?? FURNITURE_FILL} stroke={FURNITURE_STROKE} strokeWidth={0.5} cornerRadius={2} />
              )}
              {!noText && Math.max(fw, fd) > 30 && (
                <Text x={fw / 2} y={fd / 2}
                  offsetX={fw / 2} offsetY={(furnitureStyle.fontSize * scale) / 2}
                  rotation={item.labelRotation ?? 0}
                  width={fw} text={item.label}
                  fontSize={furnitureStyle.fontSize * scale} fontFamily={furnitureStyle.fontFamily}
                  fontStyle={furnitureStyle.fontStyle} fill={furnitureStyle.color} align="center" />
              )}
            </Group>
          );
        })}
      </Layer>

      {/* Beds */}
      <Layer listening={false}>
        {allBeds.map((bp) => {
          const bed = beds.find((b) => b.id === bp.bedId);
          if (!bed) return null;
          const preset = BED_PRESETS.find((p) => p.type === bed.bedType);
          if (!preset) return null;
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
            <Group key={bp.id} x={cx} y={cy} offsetX={w / 2} offsetY={h / 2} rotation={bp.rotation}>
              <Rect width={w} height={h} fill={BED_FILL}
                stroke={BED_STROKE} strokeWidth={1} cornerRadius={2}
                dash={isBunkTop ? [4, 3] : undefined} />
              {preset.pillows >= 1 && <Rect x={pOff1} y={pillowPad} width={pillowW} height={pillowH}
                fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />}
              {preset.pillows === 2 && <Rect x={pOff2} y={pillowPad} width={pillowW} height={pillowH}
                fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />}
              <Text x={0} y={h * 0.65 - 6} width={w} text={bed.label}
                fontSize={Math.max(8, Math.min(11, w * 0.1))} fill={TEXT_SECONDARY} align="center" />
            </Group>
          );
        })}
      </Layer>

      {/* Labels */}
      {showLabels && (
        <Layer listening={false}>
          {allLabels.map((label) => (
            <Text key={label.id} x={label.x * scale + ox} y={label.y * scale + oy}
              text={label.text} fontSize={label.fontSize * scale} fill={TEXT_PRIMARY} rotation={label.rotation} />
          ))}
        </Layer>
      )}

      {/* Arrows */}
      {showArrows && (
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
      )}

      {/* Titles (top layer for z-order) */}
      {showTitles && (
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
      )}

      {/* Overlay layers slot */}
      {children}
    </>
  );
}
