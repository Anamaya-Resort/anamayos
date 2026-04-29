'use client';

import { useState } from 'react';
import { Layer, Group, Rect, Text } from 'react-konva';
import { BED_PRESETS, type LayoutJson } from '../types';
import { SELECT_COLOR, OCCUPIED_FILL, OCCUPIED_TEXT } from '../colors';
import { playButtonSound } from '@/lib/button-effects';

export interface BedOccupancy {
  bedId: string;
  guestName?: string;
}

interface BookingOverlayProps {
  layoutJson: LayoutJson;
  beds: Array<{ id: string; label: string; bedType: string; capacity: number }>;
  occupancy: BedOccupancy[];
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedBedId?: string | null;
  onBedClick?: (bedId: string) => void;
}

// Terra cotta brand button color (matches --brand-btn token in globals.css).
// Konva can't read CSS vars, so we hard-code the palette here.
const HOVER_FILL = '#A35B4E';
const HOVER_FILL_OPACITY = 0.7;

/**
 * Booking overlay layer — renders on top of the base room renderer.
 * - Occupied beds: grey + "OCCUPIED" text, not clickable.
 * - Available beds: invisible by default, terra cotta on hover, ring when selected.
 * - Click on available bed: plays the AO click sound + fires onBedClick.
 */
export function BookingOverlay({
  layoutJson, beds, occupancy, scale, offsetX: ox, offsetY: oy,
  selectedBedId, onBedClick,
}: BookingOverlayProps) {
  const allBeds = layoutJson.beds ?? [];
  const occupancyMap = new Map(occupancy.map((o) => [o.bedId, o.guestName]));
  const [hoveredBedId, setHoveredBedId] = useState<string | null>(null);

  return (
    <Layer>
      {allBeds.map((bp) => {
        const bed = beds.find((b) => b.id === bp.bedId);
        if (!bed) return null;
        const preset = BED_PRESETS.find((p) => p.type === bed.bedType);
        if (!preset) return null;

        const isOccupied = occupancyMap.has(bp.bedId);
        const guestName = occupancyMap.get(bp.bedId);
        const isSelected = selectedBedId === bp.bedId;
        const isHovered = hoveredBedId === bp.bedId;
        const isInteractive = !isOccupied && !!onBedClick;

        const w = preset.width * scale, h = preset.length * scale;
        const cx = bp.x * scale + ox + w / 2, cy = bp.y * scale + oy + h / 2;

        const handleClick = () => {
          if (!isInteractive) return;
          playButtonSound();
          onBedClick?.(bp.bedId);
        };

        return (
          <Group
            key={`booking-${bp.id}`}
            x={cx}
            y={cy}
            offsetX={w / 2}
            offsetY={h / 2}
            rotation={bp.rotation}
            onClick={handleClick}
            onTap={handleClick}
            onMouseEnter={(e) => {
              if (isInteractive) {
                setHoveredBedId(bp.bedId);
                e.target.getStage()!.container().style.cursor = 'pointer';
              } else if (isOccupied) {
                e.target.getStage()!.container().style.cursor = 'not-allowed';
              }
            }}
            onMouseLeave={(e) => {
              if (hoveredBedId === bp.bedId) setHoveredBedId(null);
              e.target.getStage()!.container().style.cursor = 'default';
            }}
          >
            {/* Clickable hit area (transparent) so available beds register hover/click */}
            <Rect width={w} height={h} fill="transparent" />

            {/* Hover fill — only for available beds */}
            {isInteractive && isHovered && !isSelected && (
              <Rect
                width={w}
                height={h}
                fill={HOVER_FILL}
                opacity={HOVER_FILL_OPACITY}
                cornerRadius={2}
              />
            )}

            {/* Occupied: grey overlay + text */}
            {isOccupied && (
              <>
                <Rect width={w} height={h} fill={OCCUPIED_FILL} opacity={0.85} cornerRadius={2} />
                <Text x={0} y={h * 0.35} width={w} text="OCCUPIED"
                  fontSize={Math.max(7, Math.min(10, w * 0.09))} fill={OCCUPIED_TEXT}
                  fontStyle="bold" align="center" />
                {guestName && (
                  <Text x={0} y={h * 0.52} width={w} text={guestName}
                    fontSize={Math.max(6, Math.min(8, w * 0.07))} fill={OCCUPIED_TEXT}
                    fontStyle="italic" align="center" />
                )}
              </>
            )}

            {/* Selected ring — terra cotta to match hover */}
            {isSelected && (
              <Rect
                width={w}
                height={h}
                fill={HOVER_FILL}
                opacity={0.35}
                stroke={HOVER_FILL}
                strokeWidth={3}
                cornerRadius={2}
              />
            )}

            {/* Selection highlight border (legacy color) — kept as a thin extra ring on top */}
            {isSelected && (
              <Rect width={w} height={h} fill="transparent"
                stroke={SELECT_COLOR} strokeWidth={1} cornerRadius={2} />
            )}
          </Group>
        );
      })}
    </Layer>
  );
}
