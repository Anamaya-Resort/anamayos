'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Line } from 'react-konva';
import type Konva from 'konva';
import { BED_PRESETS, BASE_SCALE, type LayoutJson, type LayoutShape, type LayoutBedPlacement, type LayoutUnit } from './types';

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
const SHAPE_FILLS: Record<string, string> = {
  room: '#f5f5f4', bathroom: '#e0f2fe', deck: '#f0fdf4', loft: '#fef3c7',
};
const SHAPE_STROKES: Record<string, string> = {
  room: '#78716c', bathroom: '#7dd3fc', deck: '#86efac', loft: '#fcd34d',
};
const BED_FILL = '#fafaf9';
const BED_OCCUPIED = '#f1f5f9';
const BED_STROKE = '#78716c';
const BED_SELECTED_STROKE = '#3b82f6';
const PILLOW_FILL = '#f5f5f4';
const PILLOW_STROKE = '#a8a29e';

export function LayoutViewer({
  layoutJson,
  unit,
  beds,
  occupancy = [],
  onBedClick,
  selectedBedId,
}: LayoutViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 400, height: 300 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setSize({ width, height: Math.min(width * 0.6, 400) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Calculate bounds to auto-fit
  const allShapes = layoutJson.shapes ?? [];
  const allBeds = layoutJson.beds ?? [];
  const allLabels = layoutJson.labels ?? [];

  if (allShapes.length === 0 && allBeds.length === 0) {
    return null; // No layout to show
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const s of allShapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.depth);
  }
  for (const bp of allBeds) {
    const bed = beds.find((b) => b.id === bp.bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (preset) {
      minX = Math.min(minX, bp.x);
      minY = Math.min(minY, bp.y);
      maxX = Math.max(maxX, bp.x + preset.width);
      maxY = Math.max(maxY, bp.y + preset.length);
    }
  }

  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 5; maxY = 5; }

  const layoutW = maxX - minX + 0.5;
  const layoutH = maxY - minY + 0.5;
  const scaleX = (size.width - 40) / layoutW;
  const scaleY = (size.height - 40) / layoutH;
  const scale = Math.min(scaleX, scaleY, BASE_SCALE * 2);
  const offsetX = (size.width - layoutW * scale) / 2 - minX * scale;
  const offsetY = (size.height - layoutH * scale) / 2 - minY * scale;

  const occupancyMap = new Map(occupancy.map((o) => [o.bedId, o.guestName]));

  return (
    <div ref={containerRef} className="w-full">
      <Stage width={size.width} height={size.height}>
        <Layer listening={false}>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="#ffffff" />
        </Layer>

        {/* Shapes */}
        <Layer listening={false}>
          {allShapes.map((shape) => (
            <Group key={shape.id}>
              <Rect
                x={shape.x * scale + offsetX}
                y={shape.y * scale + offsetY}
                width={shape.width * scale}
                height={shape.depth * scale}
                fill={SHAPE_FILLS[shape.type] ?? '#f5f5f4'}
                stroke={SHAPE_STROKES[shape.type] ?? '#78716c'}
                strokeWidth={1}
                dash={shape.type === 'loft' ? [6, 4] : undefined}
              />
              <Text
                x={shape.x * scale + offsetX + 3}
                y={shape.y * scale + offsetY + 3}
                text={shape.type.charAt(0).toUpperCase() + shape.type.slice(1)}
                fontSize={9}
                fill="#a1a1aa"
              />
            </Group>
          ))}
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

            const w = preset.width * scale;
            const h = preset.length * scale;
            const px = bp.x * scale + offsetX;
            const py = bp.y * scale + offsetY;

            const pillowH = Math.min(h * 0.15, 0.25 * scale);
            const pillowPad = w * 0.06;
            const pillowW = preset.pillows === 2 ? (w - pillowPad * 3) / 2 : w - pillowPad * 2;
            const pillowRadius = Math.min(pillowW * 0.2, pillowH * 0.3);

            return (
              <Group
                key={bp.id}
                x={px}
                y={py}
                rotation={bp.rotation}
                onClick={() => onBedClick?.(bp.bedId)}
                onTap={() => onBedClick?.(bp.bedId)}
                onMouseEnter={(e) => {
                  if (onBedClick) e.target.getStage()!.container().style.cursor = 'pointer';
                }}
                onMouseLeave={(e) => {
                  e.target.getStage()!.container().style.cursor = 'default';
                }}
              >
                <Rect
                  width={w}
                  height={h}
                  fill={isOccupied ? BED_OCCUPIED : BED_FILL}
                  stroke={isSelected ? BED_SELECTED_STROKE : BED_STROKE}
                  strokeWidth={isSelected ? 2 : 1}
                  cornerRadius={2}
                />
                {/* Pillows */}
                {preset.pillows === 1 && (
                  <Rect
                    x={pillowPad}
                    y={pillowPad}
                    width={pillowW}
                    height={pillowH}
                    fill={PILLOW_FILL}
                    stroke={PILLOW_STROKE}
                    strokeWidth={0.5}
                    cornerRadius={pillowRadius}
                  />
                )}
                {preset.pillows === 2 && (
                  <>
                    <Rect
                      x={pillowPad}
                      y={pillowPad}
                      width={pillowW}
                      height={pillowH}
                      fill={PILLOW_FILL}
                      stroke={PILLOW_STROKE}
                      strokeWidth={0.5}
                      cornerRadius={pillowRadius}
                    />
                    <Rect
                      x={pillowPad * 2 + pillowW}
                      y={pillowPad}
                      width={pillowW}
                      height={pillowH}
                      fill={PILLOW_FILL}
                      stroke={PILLOW_STROKE}
                      strokeWidth={0.5}
                      cornerRadius={pillowRadius}
                    />
                  </>
                )}
                {/* Bed label */}
                <Text
                  x={0}
                  y={isOccupied ? h * 0.3 : h / 2 - 6}
                  width={w}
                  text={bed.label}
                  fontSize={Math.max(8, Math.min(11, w * 0.1))}
                  fill="#57534e"
                  align="center"
                />
                {/* Occupied overlay */}
                {isOccupied && guestName && (
                  <Text
                    x={0}
                    y={h * 0.5}
                    width={w}
                    text={`Occupied: ${guestName}`}
                    fontSize={Math.max(7, Math.min(9, w * 0.08))}
                    fill="#94a3b8"
                    align="center"
                    fontStyle="italic"
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Labels */}
        <Layer listening={false}>
          {allLabels.map((label) => (
            <Text
              key={label.id}
              x={label.x * scale + offsetX}
              y={label.y * scale + offsetY}
              text={label.text}
              fontSize={label.fontSize * (scale / BASE_SCALE)}
              fill="#44403c"
              rotation={label.rotation}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
