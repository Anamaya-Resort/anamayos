/**
 * Bed snapping — constrains bed placement to inside room walls.
 * Supports rectangle, circle, and semicircle room geometries.
 */

import { WALL_THICKNESS_M } from './colors';
import type { LayoutShape } from './types';

/** Snap a bed (top-left corner) to the nearest valid position inside a room shape */
export function snapBedInsideWalls(
  shapes: LayoutShape[],
  bedX: number, bedY: number, bedW: number, bedH: number,
): { x: number; y: number } {
  if (shapes.length === 0) return { x: bedX, y: bedY };
  let bx = bedX, by = bedY, bd = Infinity;

  for (const s of shapes) {
    const geo = s.geometry;

    if (geo === 'circle') {
      const cx = s.x + s.width / 2, cy = s.y + s.depth / 2;
      const innerR = Math.min(s.width, s.depth) / 2 - WALL_THICKNESS_M;
      if (innerR < Math.max(bedW, bedH) / 2) continue;

      let bCx = bedX + bedW / 2, bCy = bedY + bedH / 2;
      for (let iter = 0; iter < 5; iter++) {
        let maxOvershoot = 0, worstDx = 0, worstDy = 0;
        for (const [ox, oy] of [[0, 0], [bedW, 0], [0, bedH], [bedW, bedH]]) {
          const px = bCx - bedW / 2 + ox, py = bCy - bedH / 2 + oy;
          const dx = px - cx, dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > innerR) {
            const overshoot = dist - innerR;
            if (overshoot > maxOvershoot) { maxOvershoot = overshoot; worstDx = dx / dist; worstDy = dy / dist; }
          }
        }
        if (maxOvershoot <= 0.001) break;
        bCx -= worstDx * maxOvershoot;
        bCy -= worstDy * maxOvershoot;
      }
      const sx = bCx - bedW / 2, sy = bCy - bedH / 2;
      const d = (sx - bedX) ** 2 + (sy - bedY) ** 2;
      if (d < bd) { bd = d; bx = sx; by = sy; }

    } else if (geo === 'semicircle') {
      const cx = s.x + s.width / 2, cy = s.y + s.depth;
      const innerR = Math.min(s.width / 2, s.depth) - WALL_THICKNESS_M;
      if (innerR < Math.max(bedW, bedH) / 2) continue;

      let bCx = bedX + bedW / 2, bCy = bedY + bedH / 2;
      for (let iter = 0; iter < 5; iter++) {
        let maxOvershoot = 0, worstDx = 0, worstDy = 0;
        for (const [ox, oy] of [[0, 0], [bedW, 0], [0, bedH], [bedW, bedH]]) {
          const px = bCx - bedW / 2 + ox, py = bCy - bedH / 2 + oy;
          const dx = px - cx, dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > innerR) {
            const overshoot = dist - innerR;
            if (overshoot > maxOvershoot) { maxOvershoot = overshoot; worstDx = dx / dist; worstDy = dy / dist; }
          }
          const bottomWall = cy - WALL_THICKNESS_M;
          if (py > bottomWall) {
            const ov = py - bottomWall;
            if (ov > maxOvershoot) { maxOvershoot = ov; worstDx = 0; worstDy = 1; }
          }
        }
        if (maxOvershoot <= 0.001) break;
        bCx -= worstDx * maxOvershoot;
        bCy -= worstDy * maxOvershoot;
      }
      const sx = bCx - bedW / 2, sy = bCy - bedH / 2;
      const d = (sx - bedX) ** 2 + (sy - bedY) ** 2;
      if (d < bd) { bd = d; bx = sx; by = sy; }

    } else {
      // Rectangle
      if (s.width < bedW || s.depth < bedH) continue;
      const cx = Math.max(s.x, Math.min(bedX, s.x + s.width - bedW));
      const cy = Math.max(s.y, Math.min(bedY, s.y + s.depth - bedH));
      const d = (cx - bedX) ** 2 + (cy - bedY) ** 2;
      if (d < bd) { bd = d; bx = cx; by = cy; }
    }
  }

  if (bd === Infinity && shapes.length > 0) {
    const s = shapes[0];
    bx = Math.max(s.x, Math.min(bedX, s.x + s.width - bedW));
    by = Math.max(s.y, Math.min(bedY, s.y + s.depth - bedH));
  }
  return { x: bx, y: by };
}
