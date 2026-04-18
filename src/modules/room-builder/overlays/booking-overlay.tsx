'use client';

import { Layer, Group, Rect, Text } from 'react-konva';
import { BED_PRESETS, type LayoutJson } from '../types';
import { SELECT_COLOR } from '../colors';

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

const OCCUPIED_FILL = '#e5e7eb';    // light grey
const OCCUPIED_TEXT = '#6b7280';     // medium grey

/**
 * Booking overlay layer — renders on top of the base room renderer.
 * Shows occupied beds as grey with "OCCUPIED" text.
 * Adds click interaction for bed selection.
 */
export function BookingOverlay({
  layoutJson, beds, occupancy, scale, offsetX: ox, offsetY: oy,
  selectedBedId, onBedClick,
}: BookingOverlayProps) {
  const allBeds = layoutJson.beds ?? [];
  const occupancyMap = new Map(occupancy.map((o) => [o.bedId, o.guestName]));

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

        // Skip beds that have nothing to render (not occupied, not selected, no click handler)
        if (!isOccupied && !isSelected && !onBedClick) return null;

        const w = preset.width * scale, h = preset.length * scale;
        const cx = bp.x * scale + ox + w / 2, cy = bp.y * scale + oy + h / 2;

        return (
          <Group key={`booking-${bp.id}`} x={cx} y={cy} offsetX={w / 2} offsetY={h / 2} rotation={bp.rotation}
            onClick={() => onBedClick?.(bp.bedId)}
            onTap={() => onBedClick?.(bp.bedId)}
            onMouseEnter={(e) => { if (onBedClick) e.target.getStage()!.container().style.cursor = 'pointer'; }}
            onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
          >
            {/* Clickable hit area (transparent) so non-occupied beds can be selected */}
            <Rect width={w} height={h} fill="transparent" />

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

            {/* Selection highlight border */}
            {isSelected && (
              <Rect width={w} height={h} fill="transparent"
                stroke={SELECT_COLOR} strokeWidth={2} cornerRadius={2} />
            )}
          </Group>
        );
      })}
    </Layer>
  );
}
