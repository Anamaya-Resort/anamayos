'use client';

import { useEffect, useRef, useState } from 'react';
import { Group, Rect, Line, Text } from 'react-konva';
import { BED_PRESETS, type LayoutBedPlacement } from './types';
import type { RoomBed } from './room-builder-shell';

interface SplitKingConnectorProps {
  placements: LayoutBedPlacement[];
  beds: RoomBed[];
  scale: number;
  panX: number;
  panY: number;
  onTogglePair: (idA: string, idB: string) => void;
}

/** Distance threshold (meters) for two single_longs to be considered adjacent */
const SNAP_THRESHOLD = 0.15;

interface Pair {
  a: LayoutBedPlacement;
  b: LayoutBedPlacement;
  isPaired: boolean;
}

function findSingleLongPairs(
  placements: LayoutBedPlacement[],
  beds: RoomBed[],
): Pair[] {
  const singleLongs = placements.filter((p) => {
    const bed = beds.find((b) => b.id === p.bedId);
    return bed?.bedType === 'single_long';
  });

  const pairs: Pair[] = [];
  const used = new Set<string>();

  // Check if already paired
  for (const p of singleLongs) {
    if (p.splitKingPairId && !used.has(p.id)) {
      const partner = singleLongs.find((s) => s.id === p.splitKingPairId);
      if (partner) {
        pairs.push({ a: p, b: partner, isPaired: true });
        used.add(p.id);
        used.add(partner.id);
      }
    }
  }

  // Find adjacent unpaired singles
  const preset = BED_PRESETS.find((p) => p.type === 'single_long');
  if (!preset) return pairs;
  for (let i = 0; i < singleLongs.length; i++) {
    if (used.has(singleLongs[i].id)) continue;
    for (let j = i + 1; j < singleLongs.length; j++) {
      if (used.has(singleLongs[j].id)) continue;
      const a = singleLongs[i];
      const b = singleLongs[j];

      // Same rotation required
      if (a.rotation !== b.rotation) continue;

      // Check adjacency — side by side (width apart)
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);

      // Horizontal adjacency: same y, x differs by ~width
      const sideAdj = Math.abs(dx - preset.width) < SNAP_THRESHOLD && dy < SNAP_THRESHOLD;
      // Vertical adjacency (if rotated 90): same x, y differs by ~width
      const vertAdj = Math.abs(dy - preset.width) < SNAP_THRESHOLD && dx < SNAP_THRESHOLD;

      if (sideAdj || vertAdj) {
        pairs.push({ a, b, isPaired: false });
        used.add(a.id);
        used.add(b.id);
      }
    }
  }

  return pairs;
}

export function SplitKingConnectors({
  placements,
  beds,
  scale,
  panX,
  panY,
  onTogglePair,
}: SplitKingConnectorProps) {
  const pairs = findSingleLongPairs(placements, beds);

  if (pairs.length === 0) return null;

  const preset = BED_PRESETS.find((p) => p.type === 'single_long');
  if (!preset) return null;

  return (
    <>
      {pairs.map((pair) => {
        // Midpoint between the two beds
        const midX = ((pair.a.x + pair.b.x) / 2 + preset.width / 2) * scale + panX;
        const midY = ((pair.a.y + pair.b.y) / 2 + preset.length / 2) * scale + panY;

        const size = Math.max(16, 20 * (scale / 80));

        return (
          <Group
            key={`sk-${pair.a.id}-${pair.b.id}`}
            x={midX - size / 2}
            y={midY - size / 2}
            onClick={() => onTogglePair(pair.a.id, pair.b.id)}
            onTap={() => onTogglePair(pair.a.id, pair.b.id)}
          >
            {/* Background circle */}
            <Rect
              width={size}
              height={size}
              fill={pair.isPaired ? '#dbeafe' : '#fef3c7'}
              stroke={pair.isPaired ? '#3b82f6' : '#f59e0b'}
              strokeWidth={1}
              cornerRadius={size / 2}
              onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
              onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
            />
            {/* Arrows icon */}
            {pair.isPaired ? (
              // Outward arrows (unmerge)
              <>
                <Line
                  points={[size * 0.25, size * 0.5, size * 0.1, size * 0.5]}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                />
                <Line
                  points={[size * 0.75, size * 0.5, size * 0.9, size * 0.5]}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                />
              </>
            ) : (
              // Inward arrows (merge)
              <>
                <Line
                  points={[size * 0.15, size * 0.5, size * 0.4, size * 0.5]}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                />
                <Line
                  points={[size * 0.85, size * 0.5, size * 0.6, size * 0.5]}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                />
              </>
            )}
          </Group>
        );
      })}
    </>
  );
}
