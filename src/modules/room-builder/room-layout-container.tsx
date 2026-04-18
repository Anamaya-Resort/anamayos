'use client';

import { useEffect, useRef, useState } from 'react';
import { BED_PRESETS, BASE_SCALE, type LayoutJson } from './types';

interface RoomLayoutContainerProps {
  layoutJson: LayoutJson;
  beds: Array<{ id: string; label: string; bedType: string; capacity: number }>;
  maxHeight?: number;
  aspectRatio?: number;
  children: (props: { width: number; height: number; scale: number; offsetX: number; offsetY: number }) => React.ReactNode;
}

/**
 * Responsive container that computes auto-fit scale and offset for a room layout.
 * Uses a render-prop pattern so consumers control what's inside (Stage, layers, overlays).
 */
export function RoomLayoutContainer({ layoutJson, beds, maxHeight = 500, aspectRatio = 0.65, children }: RoomLayoutContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setSize({ width, height: Math.max(200, Math.min(width * aspectRatio, maxHeight)) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [aspectRatio, maxHeight]);

  const allShapes = layoutJson.shapes ?? [];
  const allBeds = layoutJson.beds ?? [];
  const allFurniture = layoutJson.furniture ?? [];
  const allArrows = layoutJson.arrows ?? [];
  const allOpenings = layoutJson.openings ?? [];
  const allLabels = layoutJson.labels ?? [];

  if (allShapes.length === 0 && allBeds.length === 0) return null;
  if (size.width === 0) return <div ref={containerRef} className="w-full" style={{ minHeight: 100 }} />;

  // Compute bounding box across ALL element types
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of allShapes) { minX = Math.min(minX, s.x); minY = Math.min(minY, s.y); maxX = Math.max(maxX, s.x + s.width); maxY = Math.max(maxY, s.y + s.depth); }
  for (const bp of allBeds) {
    const bed = beds.find((b) => b.id === bp.bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (preset) { minX = Math.min(minX, bp.x); minY = Math.min(minY, bp.y); maxX = Math.max(maxX, bp.x + preset.width); maxY = Math.max(maxY, bp.y + preset.length); }
  }
  for (const f of allFurniture) { minX = Math.min(minX, f.x); minY = Math.min(minY, f.y); maxX = Math.max(maxX, f.x + f.width); maxY = Math.max(maxY, f.y + f.depth); }
  for (const ar of allArrows) { minX = Math.min(minX, ar.x1, ar.x2); minY = Math.min(minY, ar.y1, ar.y2); maxX = Math.max(maxX, ar.x1, ar.x2); maxY = Math.max(maxY, ar.y1, ar.y2); }
  for (const op of allOpenings) { minX = Math.min(minX, op.x1, op.x2); minY = Math.min(minY, op.y1, op.y2); maxX = Math.max(maxX, op.x1, op.x2); maxY = Math.max(maxY, op.y1, op.y2); }
  for (const lb of allLabels) {
    const estW = Math.max(1, lb.text.length * lb.fontSize * 0.6);
    minX = Math.min(minX, lb.x); minY = Math.min(minY, lb.y);
    maxX = Math.max(maxX, lb.x + estW); maxY = Math.max(maxY, lb.y + lb.fontSize * 1.3);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 5; maxY = 5; }

  const PAD = 0.3;
  const layoutW = maxX - minX + PAD * 2, layoutH = maxY - minY + PAD * 2;
  const scale = Math.min((size.width - 20) / layoutW, (size.height - 20) / layoutH, BASE_SCALE * 2);
  const offsetX = (size.width - layoutW * scale) / 2 - (minX - PAD) * scale;
  const offsetY = (size.height - layoutH * scale) / 2 - (minY - PAD) * scale;

  return (
    <div ref={containerRef} className="w-full">
      {children({ width: size.width, height: size.height, scale, offsetX, offsetY })}
    </div>
  );
}
