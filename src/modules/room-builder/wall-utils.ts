/**
 * Wall geometry utilities — wall segment generation, projection, nearest-wall search.
 * Used by builder-canvas for door/window snapping and bed constraints.
 */

import { WALL_THICKNESS_M } from './colors';
import type { LayoutShape } from './types';

/** A wall segment defined by two points */
export interface WallSegment {
  x1: number; y1: number; x2: number; y2: number;
}

/** Number of arc segments to approximate a circle wall */
const CIRCLE_WALL_SEGMENTS = 24;

/** Get wall segments of a shape (in meters), offset inward by half wall thickness */
export function getShapeWalls(shape: LayoutShape): WallSegment[] {
  const { x, y, width, depth } = shape;
  const hw = (shape.type === 'deck' ? WALL_THICKNESS_M / 2 : WALL_THICKNESS_M) / 2;
  const geo = shape.geometry;

  if (geo === 'circle') {
    const cx = x + width / 2, cy = y + depth / 2;
    const r = Math.min(width, depth) / 2 - hw;
    const segs: WallSegment[] = [];
    for (let i = 0; i < CIRCLE_WALL_SEGMENTS; i++) {
      const a1 = (i / CIRCLE_WALL_SEGMENTS) * Math.PI * 2;
      const a2 = ((i + 1) / CIRCLE_WALL_SEGMENTS) * Math.PI * 2;
      segs.push({ x1: cx + r * Math.cos(a1), y1: cy + r * Math.sin(a1), x2: cx + r * Math.cos(a2), y2: cy + r * Math.sin(a2) });
    }
    return segs;
  }

  if (geo === 'semicircle') {
    const cx = x + width / 2, cy = y + depth;
    const r = Math.min(width / 2, depth) - hw;
    const segs: WallSegment[] = [];
    const halfSegs = Math.ceil(CIRCLE_WALL_SEGMENTS / 2);
    for (let i = 0; i < halfSegs; i++) {
      const a1 = Math.PI + (i / halfSegs) * Math.PI;
      const a2 = Math.PI + ((i + 1) / halfSegs) * Math.PI;
      segs.push({ x1: cx + r * Math.cos(a1), y1: cy + r * Math.sin(a1), x2: cx + r * Math.cos(a2), y2: cy + r * Math.sin(a2) });
    }
    segs.push({ x1: x + width - hw, y1: y + depth - hw, x2: x + hw, y2: y + depth - hw });
    return segs;
  }

  return [
    { x1: x, y1: y + hw, x2: x + width, y2: y + hw },
    { x1: x + width - hw, y1: y, x2: x + width - hw, y2: y + depth },
    { x1: x + width, y1: y + depth - hw, x2: x, y2: y + depth - hw },
    { x1: x + hw, y1: y + depth, x2: x + hw, y2: y },
  ];
}

/** Project point onto a line segment, return projected point and distance */
export function projectOntoSegment(px: number, py: number, seg: WallSegment): { x: number; y: number; dist: number; t: number } {
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: seg.x1, y: seg.y1, dist: Math.sqrt((px - seg.x1) ** 2 + (py - seg.y1) ** 2), t: 0 };
  const t = Math.max(0, Math.min(1, ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2));
  const projX = seg.x1 + t * dx, projY = seg.y1 + t * dy;
  const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  return { x: projX, y: projY, dist, t };
}

/** Find the nearest wall segment to a point across all shapes, within maxDist (meters) */
export function findNearestWall(px: number, py: number, shapes: LayoutShape[], maxDist: number): { seg: WallSegment; proj: { x: number; y: number; t: number } } | null {
  let best: { seg: WallSegment; proj: { x: number; y: number; t: number }; dist: number } | null = null;
  for (const shape of shapes) {
    for (const seg of getShapeWalls(shape)) {
      const proj = projectOntoSegment(px, py, seg);
      if (proj.dist < maxDist && (!best || proj.dist < best.dist)) {
        best = { seg, proj: { x: proj.x, y: proj.y, t: proj.t }, dist: proj.dist };
      }
    }
  }
  return best ? { seg: best.seg, proj: best.proj } : null;
}
