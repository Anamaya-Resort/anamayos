'use client';

import { Group, Rect, Text, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
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
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (x: number, y: number) => void;
  onRotate: (rotation: number) => void;
  onStartRename?: (screenX: number, screenY: number, width: number) => void;
  fontFamily?: string;
  draggable: boolean;
  placementId?: string;
}

const BED_FILL = '#fafaf9';
const BED_STROKE = '#78716c';
const BED_SELECTED_STROKE = '#3b82f6';
const PILLOW_FILL = '#f5f5f4';
const PILLOW_STROKE = '#a8a29e';
const BUNK_TOP_DASH = [4, 3];

export function BedShape({
  placement, bed, scale, panX, panY, isSelected,
  onSelect, onDragMove, onDragEnd, onRotate, onStartRename, fontFamily,
  draggable, placementId,
}: BedShapeProps) {
  const preset = BED_PRESETS.find((p) => p.type === bed.bedType);
  if (!preset) return null;

  const w = preset.width * scale;
  const h = preset.length * scale;
  const cx = placement.x * scale + panX + w / 2;
  const cy = placement.y * scale + panY + h / 2;

  const isBunkTop = bed.bedType === 'bunk_top';
  const pillowCount = preset.pillows;

  const pillowH = Math.min(h * 0.15, 0.25 * scale) * 1.3;
  const pillowPad = w * 0.06;
  const pillowWBase = pillowCount === 2 ? (w - pillowPad * 3) / 2 : w - pillowPad * 2;
  const pillowW = pillowWBase * 0.8;
  const pillowOffsetX1 = pillowPad + (pillowWBase - pillowW) / 2;
  const pillowOffsetX2 = pillowPad * 2 + pillowWBase + (pillowWBase - pillowW) / 2;
  const pillowY = pillowPad;
  const pillowRadius = Math.min(pillowW * 0.2, pillowH * 0.3);

  return (
    <Group
      x={cx} y={cy}
      offsetX={w / 2} offsetY={h / 2}
      rotation={placement.rotation}
      draggable={draggable}
      data-placement-id={placementId}
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        const newCx = e.target.x();
        const newCy = e.target.y();
        const newX = (newCx - w / 2 - panX) / scale;
        const newY = (newCy - h / 2 - panY) / scale;
        onDragEnd(newX, newY);
      }}
      onDblClick={() => {
        const newRotation = (Math.round((placement.rotation + 45) / 45) * 45) % 360;
        onRotate(newRotation);
      }}
    >
      <Rect x={0} y={0} width={w} height={h}
        fill={BED_FILL}
        stroke={isSelected ? BED_SELECTED_STROKE : BED_STROKE}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={2}
        dash={isBunkTop ? BUNK_TOP_DASH : undefined}
      />

      {pillowCount >= 1 && (
        <Rect x={pillowOffsetX1} y={pillowY} width={pillowW} height={pillowH}
          fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />
      )}
      {pillowCount === 2 && (
        <Rect x={pillowOffsetX2} y={pillowY} width={pillowW} height={pillowH}
          fill={PILLOW_FILL} stroke={PILLOW_STROKE} strokeWidth={0.5} cornerRadius={pillowRadius} />
      )}

      {/* Bed label — double-click to start inline rename */}
      <Text
        x={0} y={h / 2 - 6} width={w}
        text={bed.label}
        fontSize={Math.max(9, Math.min(12, w * 0.12))}
        fontFamily={fontFamily ?? 'Arial'}
        fill="#57534e" align="center"
        onDblClick={(e) => {
          e.cancelBubble = true;
          if (!onStartRename) return;
          // Get absolute screen position of this text
          const stage = e.target.getStage();
          if (!stage) return;
          const container = stage.container().getBoundingClientRect();
          const absPos = e.target.getAbsolutePosition();
          onStartRename(
            absPos.x + container.left,
            absPos.y + container.top,
            w,
          );
        }}
      />

      {isSelected && (
        <Group>
          <Line points={[w / 2, h, w / 2, h + 12]} stroke="#3b82f6" strokeWidth={1} />
          <Rect x={w / 2 - 4} y={h + 8} width={8} height={8} fill="#3b82f6" cornerRadius={4}
            onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'grab'; }}
            onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
          />
        </Group>
      )}
    </Group>
  );
}
