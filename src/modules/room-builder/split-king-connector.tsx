'use client';

import { Group, Rect, Line, Text, Circle } from 'react-konva';
import { BED_PRESETS, BASE_SCALE, type LayoutBedPlacement } from './types';
import type { RoomBed } from './room-builder-shell';

interface SplitKingConnectorProps {
  placements: LayoutBedPlacement[];
  beds: RoomBed[];
  scale: number;
  panX: number;
  panY: number;
  bgColor: string;
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

  for (let i = 0; i < eligible.length; i++) {
    if (used.has(eligible[i].id)) continue;
    for (let j = i + 1; j < eligible.length; j++) {
      if (used.has(eligible[j].id)) continue;
      const a = eligible[i], b = eligible[j];
      const aPreset = getPreset(a), bPreset = getPreset(b);
      if (!aPreset || !bPreset) continue;
      if (a.rotation !== b.rotation) continue;
      if (Math.abs(aPreset.length - bPreset.length) > 0.01) continue;

      const rad = (a.rotation * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const dx = b.x - a.x, dy = b.y - a.y;
      const projWidth = dx * cos + dy * sin;
      const projLength = -dx * sin + dy * cos;
      const expectedGap = aPreset.width;
      if (Math.abs(Math.abs(projWidth) - expectedGap) < SNAP_THRESHOLD && Math.abs(projLength) < SNAP_THRESHOLD) {
        pairs.push({ a, b, aPreset, bPreset, isPaired: false });
        used.add(a.id);
        used.add(b.id);
      }
    }
  }

  return pairs;
}

export function SplitKingConnectors({ placements, beds, scale, panX, panY, bgColor, onTogglePair }: SplitKingConnectorProps) {
  const pairs = findPairableBeds(placements, beds);
  if (pairs.length === 0) return null;

  return (
    <>
      {pairs.map((pair) => {
        const aCx = pair.a.x + pair.aPreset.width / 2;
        const aCy = pair.a.y + pair.aPreset.length / 2;
        const bCx = pair.b.x + pair.bPreset.width / 2;
        const bCy = pair.b.y + pair.bPreset.length / 2;
        const midX = ((aCx + bCx) / 2) * scale + panX;
        const midY = ((aCy + bCy) / 2) * scale + panY;
        const r = Math.max(10, 13 * (scale / BASE_SCALE));
        const strokeW = 2.25; // 50% thicker than original 1.5

        // Arrow direction: horizontal relative to circle
        const arrowLen = r * 0.55;
        const headLen = r * 0.3;

        // "SPLIT KING" text position — above bed names (bed names are at center of beds)
        const leftX = Math.min(pair.a.x, pair.b.x);
        const totalW = Math.max(pair.a.x + pair.aPreset.width, pair.b.x + pair.bPreset.width) - leftX;
        const textX = (leftX + totalW / 2) * scale + panX;
        // Bed names sit at y + length/2. Position SPLIT KING just above that.
        const bedNameY = ((pair.a.y + pair.b.y) / 2 + pair.aPreset.length / 2) * scale + panY;
        const textY = bedNameY - 12 * (scale / BASE_SCALE);
        const textFs = Math.max(8, 10 * (scale / BASE_SCALE));

        return (
          <Group key={`sk-${pair.a.id}-${pair.b.id}`}>
            {/* "SPLIT KING" text with background (only when paired) */}
            {pair.isPaired && (
              <Group x={textX} y={textY} offsetX={30} listening={false}>
                <Rect x={-3} y={-2} width={66} height={textFs + 4} fill={bgColor} cornerRadius={3} />
                <Text x={0} y={0} width={60} text="SPLIT KING" fontSize={textFs}
                  fontStyle="bold" fill="#78716c" align="center" />
              </Group>
            )}

            {/* Circle button */}
            <Group x={midX} y={midY}
              onClick={() => onTogglePair(pair.a.id, pair.b.id)}
              onTap={() => onTogglePair(pair.a.id, pair.b.id)}>
              <Circle radius={r}
                fill={pair.isPaired ? '#dbeafe' : '#fef3c7'}
                stroke={pair.isPaired ? '#3b82f6' : '#f59e0b'}
                strokeWidth={1.5}
                onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
                onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
              />

              {pair.isPaired ? (
                /* Paired: arrows pointing OUTWARD from center (split) */
                <>
                  {/* Left arrow ← */}
                  <Line points={[-arrowLen, 0, -r * 0.1, 0]} stroke="#3b82f6" strokeWidth={strokeW} lineCap="round" />
                  <Line points={[-arrowLen + headLen * 0.7, -headLen * 0.5, -arrowLen, 0, -arrowLen + headLen * 0.7, headLen * 0.5]}
                    stroke="#3b82f6" strokeWidth={strokeW} lineCap="round" lineJoin="round" />
                  {/* Right arrow → */}
                  <Line points={[r * 0.1, 0, arrowLen, 0]} stroke="#3b82f6" strokeWidth={strokeW} lineCap="round" />
                  <Line points={[arrowLen - headLen * 0.7, -headLen * 0.5, arrowLen, 0, arrowLen - headLen * 0.7, headLen * 0.5]}
                    stroke="#3b82f6" strokeWidth={strokeW} lineCap="round" lineJoin="round" />
                </>
              ) : (
                /* Unpaired: arrows pointing INWARD toward center (join) */
                <>
                  {/* Left arrow → (pointing right toward center) */}
                  <Line points={[-arrowLen, 0, -r * 0.1, 0]} stroke="#f59e0b" strokeWidth={strokeW} lineCap="round" />
                  <Line points={[-r * 0.1 - headLen * 0.7, -headLen * 0.5, -r * 0.1, 0, -r * 0.1 - headLen * 0.7, headLen * 0.5]}
                    stroke="#f59e0b" strokeWidth={strokeW} lineCap="round" lineJoin="round" />
                  {/* Right arrow ← (pointing left toward center) */}
                  <Line points={[r * 0.1, 0, arrowLen, 0]} stroke="#f59e0b" strokeWidth={strokeW} lineCap="round" />
                  <Line points={[r * 0.1 + headLen * 0.7, -headLen * 0.5, r * 0.1, 0, r * 0.1 + headLen * 0.7, headLen * 0.5]}
                    stroke="#f59e0b" strokeWidth={strokeW} lineCap="round" lineJoin="round" />
                </>
              )}
            </Group>
          </Group>
        );
      })}
    </>
  );
}
