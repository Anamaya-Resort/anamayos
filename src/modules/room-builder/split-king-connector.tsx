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
  dragOffset: { placementId: string; dx: number; dy: number } | null;
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

export function SplitKingConnectors({ placements, beds, scale, panX, panY, bgColor, dragOffset, onTogglePair }: SplitKingConnectorProps) {
  const pairs = findPairableBeds(placements, beds);
  if (pairs.length === 0) return null;

  return (
    <>
      {pairs.map((pair) => {
        const aCx = pair.a.x + pair.aPreset.width / 2;
        const aCy = pair.a.y + pair.aPreset.length / 2;
        const bCx = pair.b.x + pair.bPreset.width / 2;
        const bCy = pair.b.y + pair.bPreset.length / 2;
        // Apply drag offset if this pair is being dragged
        const isDragging = dragOffset && (dragOffset.placementId === pair.a.id || dragOffset.placementId === pair.b.id);
        const offX = isDragging ? dragOffset.dx : 0;
        const offY = isDragging ? dragOffset.dy : 0;
        const midX = ((aCx + bCx) / 2) * scale + panX + offX;
        const midY = ((aCy + bCy) / 2) * scale + panY + offY;
        const r = Math.max(10, 13 * (scale / BASE_SCALE));
        const strokeW = 2.25; // 50% thicker than original 1.5

        // Arrow direction: horizontal relative to circle
        const arrowLen = r * 0.55;
        const headLen = r * 0.3;

        const textFs = Math.max(8, 10 * (scale / BASE_SCALE));
        const textW = 60;
        const rot = pair.a.rotation ?? 0;
        const rad = (rot * Math.PI) / 180;
        // Text offset: 30% of bed length in the "up" direction (perpendicular to width, toward pillows)
        const offsetAlongLength = pair.aPreset.length * 0.3;
        // "Up" in bed space is -Y (toward pillows), rotated by bed rotation
        const textOffX = -offsetAlongLength * Math.sin(rad);
        const textOffY = offsetAlongLength * Math.cos(rad);

        return (
          <Group key={`sk-${pair.a.id}-${pair.b.id}`}>
            {/* "SPLIT KING" text — rotated to match beds */}
            {pair.isPaired && (
              <Group x={midX + textOffX * scale} y={midY + textOffY * scale} rotation={rot} offsetX={textW / 2} listening={false}>
                <Rect x={-3} y={-2} width={textW + 6} height={textFs + 4} fill={bgColor} cornerRadius={3} />
                <Text x={0} y={0} width={textW} text="SPLIT KING" fontSize={textFs}
                  fontStyle="bold" fill="#78716c" align="center" />
              </Group>
            )}

            {/* Circle button — rotated to match bed orientation */}
            <Group x={midX} y={midY} rotation={pair.a.rotation}
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
