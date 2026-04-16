'use client';

import { Group, Rect, Line } from 'react-konva';
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

const SNAP_THRESHOLD = 0.15;
const PAIRABLE_TYPES = new Set(['single', 'single_long']);

interface Pair {
  a: LayoutBedPlacement;
  b: LayoutBedPlacement;
  aPreset: { width: number; length: number };
  bPreset: { width: number; length: number };
  isPaired: boolean;
}

function findPairableBeds(placements: LayoutBedPlacement[], beds: RoomBed[]): Pair[] {
  // Filter to pairable bed types
  const eligible = placements.filter((p) => {
    const bed = beds.find((b) => b.id === p.bedId);
    return bed && PAIRABLE_TYPES.has(bed.bedType);
  });

  const pairs: Pair[] = [];
  const used = new Set<string>();

  const getPreset = (p: LayoutBedPlacement) => {
    const bed = beds.find((b) => b.id === p.bedId);
    return bed ? BED_PRESETS.find((pr) => pr.type === bed.bedType) : null;
  };

  // Already paired
  for (const p of eligible) {
    if (p.splitKingPairId && !used.has(p.id)) {
      const partner = eligible.find((s) => s.id === p.splitKingPairId);
      const aPreset = getPreset(p);
      const bPreset = partner ? getPreset(partner) : null;
      if (partner && aPreset && bPreset) {
        pairs.push({ a: p, b: partner, aPreset, bPreset, isPaired: true });
        used.add(p.id);
        used.add(partner.id);
      }
    }
  }

  // Find adjacent unpaired — must have same rotation and be side-by-side
  for (let i = 0; i < eligible.length; i++) {
    if (used.has(eligible[i].id)) continue;
    for (let j = i + 1; j < eligible.length; j++) {
      if (used.has(eligible[j].id)) continue;
      const a = eligible[i], b = eligible[j];
      const aPreset = getPreset(a), bPreset = getPreset(b);
      if (!aPreset || !bPreset) continue;

      // Same rotation required
      if (a.rotation !== b.rotation) continue;

      // Both must have same length (can't pair a single with single_long)
      if (Math.abs(aPreset.length - bPreset.length) > 0.01) continue;

      const rad = (a.rotation * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);

      // The "side-by-side" offset is along the width direction (perpendicular to length)
      // At rotation θ, width direction is (cos θ, sin θ)
      const dx = b.x - a.x, dy = b.y - a.y;
      // Project onto width axis and length axis
      const projWidth = dx * cos + dy * sin;
      const projLength = -dx * sin + dy * cos;

      const expectedGap = aPreset.width; // beds touch at this distance
      const sideAdj = Math.abs(Math.abs(projWidth) - expectedGap) < SNAP_THRESHOLD && Math.abs(projLength) < SNAP_THRESHOLD;

      if (sideAdj) {
        pairs.push({ a, b, aPreset, bPreset, isPaired: false });
        used.add(a.id);
        used.add(b.id);
      }
    }
  }

  return pairs;
}

export function SplitKingConnectors({ placements, beds, scale, panX, panY, onTogglePair }: SplitKingConnectorProps) {
  const pairs = findPairableBeds(placements, beds);
  if (pairs.length === 0) return null;

  return (
    <>
      {pairs.map((pair) => {
        // Midpoint between the two beds (using bed centers)
        const aCx = pair.a.x + pair.aPreset.width / 2;
        const aCy = pair.a.y + pair.aPreset.length / 2;
        const bCx = pair.b.x + pair.bPreset.width / 2;
        const bCy = pair.b.y + pair.bPreset.length / 2;
        const midX = ((aCx + bCx) / 2) * scale + panX;
        const midY = ((aCy + bCy) / 2) * scale + panY;
        const size = Math.max(16, 20 * (scale / 80));

        return (
          <Group key={`sk-${pair.a.id}-${pair.b.id}`}
            x={midX - size / 2} y={midY - size / 2}
            onClick={() => onTogglePair(pair.a.id, pair.b.id)}
            onTap={() => onTogglePair(pair.a.id, pair.b.id)}>
            <Rect width={size} height={size}
              fill={pair.isPaired ? '#dbeafe' : '#fef3c7'}
              stroke={pair.isPaired ? '#3b82f6' : '#f59e0b'}
              strokeWidth={1} cornerRadius={size / 2}
              onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
              onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
            />
            {pair.isPaired ? (
              <>
                <Line points={[size * 0.25, size * 0.5, size * 0.1, size * 0.5]} stroke="#3b82f6" strokeWidth={1.5} />
                <Line points={[size * 0.75, size * 0.5, size * 0.9, size * 0.5]} stroke="#3b82f6" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <Line points={[size * 0.15, size * 0.5, size * 0.4, size * 0.5]} stroke="#f59e0b" strokeWidth={1.5} />
                <Line points={[size * 0.85, size * 0.5, size * 0.6, size * 0.5]} stroke="#f59e0b" strokeWidth={1.5} />
              </>
            )}
          </Group>
        );
      })}
    </>
  );
}
