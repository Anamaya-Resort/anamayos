'use client';

import { Group, Rect, Text, Line } from 'react-konva';
import { BED_PRESETS, type LayoutBedPlacement } from './types';
import type { RoomBed } from './room-builder-shell';

interface BedShapeProps {
  placement: LayoutBedPlacement;
  bed: RoomBed;
  scale: number;
  panX: number;
  panY: number;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onRotate: (rotation: number) => void;
  draggable: boolean;
}

// Bed colors
const BED_FILL = '#fafaf9';
const BED_STROKE = '#78716c';
const BED_SELECTED_STROKE = '#3b82f6';
const PILLOW_FILL = '#f5f5f4';
const PILLOW_STROKE = '#a8a29e';
const BUNK_TOP_DASH = [4, 3];

export function BedShape({
  placement,
  bed,
  scale,
  panX,
  panY,
  isSelected,
  onSelect,
  onDragEnd,
  onRotate,
  draggable,
}: BedShapeProps) {
  const preset = BED_PRESETS.find((p) => p.type === bed.bedType);
  if (!preset) return null;

  const w = preset.width * scale;
  const h = preset.length * scale;
  const px = placement.x * scale + panX;
  const py = placement.y * scale + panY;

  const isBunkTop = bed.bedType === 'bunk_top';
  const pillowCount = preset.pillows;

  // Pillow dimensions (relative to bed)
  const pillowH = Math.min(h * 0.15, 0.25 * scale);
  const pillowPad = w * 0.06;
  const pillowW = pillowCount === 2
    ? (w - pillowPad * 3) / 2
    : w - pillowPad * 2;
  const pillowY = pillowPad;
  const pillowRadius = Math.min(pillowW * 0.2, pillowH * 0.3);

  return (
    <Group
      x={px}
      y={py}
      rotation={placement.rotation}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        const newX = (e.target.x() - panX) / scale;
        const newY = (e.target.y() - panY) / scale;
        onDragEnd(newX, newY);
        e.target.x(newX * scale + panX);
        e.target.y(newY * scale + panY);
      }}
      onDblClick={() => {
        // Double-click to rotate 45 degrees
        const newRotation = (Math.round((placement.rotation + 45) / 45) * 45) % 360;
        onRotate(newRotation);
      }}
    >
      {/* Bed rectangle */}
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill={BED_FILL}
        stroke={isSelected ? BED_SELECTED_STROKE : BED_STROKE}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={2}
        dash={isBunkTop ? BUNK_TOP_DASH : undefined}
      />

      {/* Pillow(s) */}
      {pillowCount === 1 && (
        <Rect
          x={pillowPad}
          y={pillowY}
          width={pillowW}
          height={pillowH}
          fill={PILLOW_FILL}
          stroke={PILLOW_STROKE}
          strokeWidth={0.5}
          cornerRadius={pillowRadius}
        />
      )}
      {pillowCount === 2 && (
        <>
          <Rect
            x={pillowPad}
            y={pillowY}
            width={pillowW}
            height={pillowH}
            fill={PILLOW_FILL}
            stroke={PILLOW_STROKE}
            strokeWidth={0.5}
            cornerRadius={pillowRadius}
          />
          <Rect
            x={pillowPad * 2 + pillowW}
            y={pillowY}
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
        y={h / 2 - 6}
        width={w}
        text={bed.label}
        fontSize={Math.max(9, Math.min(12, w * 0.12))}
        fill="#57534e"
        align="center"
      />

      {/* Rotation handle when selected */}
      {isSelected && (
        <Group>
          {/* Small rotation indicator at bottom center */}
          <Line
            points={[w / 2, h, w / 2, h + 12]}
            stroke="#3b82f6"
            strokeWidth={1}
          />
          <Rect
            x={w / 2 - 4}
            y={h + 8}
            width={8}
            height={8}
            fill="#3b82f6"
            cornerRadius={4}
            onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'grab'; }}
            onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
          />
        </Group>
      )}
    </Group>
  );
}
