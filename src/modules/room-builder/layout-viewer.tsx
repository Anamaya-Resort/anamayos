'use client';

import { Stage, Layer, Rect } from 'react-konva';
import { RoomLayoutContainer } from './room-layout-container';
import { RoomBaseRenderer } from './room-base-renderer';
import { BookingOverlay, type BedOccupancy } from './overlays/booking-overlay';
import { type LayoutJson, type LayoutUnit } from './types';
import { CANVAS_BG } from './colors';

// Re-export for backward compatibility
export type { BedOccupancy };

interface LayoutViewerProps {
  layoutJson: LayoutJson;
  unit: LayoutUnit;
  beds: Array<{ id: string; label: string; bedType: string; capacity: number }>;
  occupancy?: BedOccupancy[];
  onBedClick?: (bedId: string) => void;
  selectedBedId?: string | null;
}

/**
 * Read-only room layout viewer. Uses the shared RoomBaseRenderer + BookingOverlay.
 * Drop-in replacement for the old monolithic LayoutViewer.
 */
export function LayoutViewer({ layoutJson, unit, beds, occupancy = [], onBedClick, selectedBedId }: LayoutViewerProps) {
  return (
    <RoomLayoutContainer layoutJson={layoutJson} beds={beds}>
      {({ width, height, scale, offsetX, offsetY }) => (
        <Stage width={width || 1} height={height || 1}>
          <Layer listening={false}>
            <Rect x={0} y={0} width={width} height={height} fill={CANVAS_BG} />
          </Layer>
          <RoomBaseRenderer
            layoutJson={layoutJson}
            beds={beds}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
            resortConfig={layoutJson.resortConfig}
          >
            {occupancy.length > 0 && (
              <BookingOverlay
                layoutJson={layoutJson}
                beds={beds}
                occupancy={occupancy}
                scale={scale}
                offsetX={offsetX}
                offsetY={offsetY}
                selectedBedId={selectedBedId}
                onBedClick={onBedClick}
              />
            )}
          </RoomBaseRenderer>
        </Stage>
      )}
    </RoomLayoutContainer>
  );
}
