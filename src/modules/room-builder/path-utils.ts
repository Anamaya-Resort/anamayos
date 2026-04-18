/**
 * Shared path-tracing utilities for room rendering.
 * Used by both the builder-canvas (editor) and room-base-renderer (viewer).
 */

// Canvas context interface for path tracing
export type PathCtx = {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, ccw?: boolean): void;
  closePath(): void;
};
export type PathCtxNoBegin = Omit<PathCtx, 'beginPath'>;

/** Parse a wallCurves entry (supports old number format and new {offset, along} format) */
export function parseWallCurve(val: number | { offset: number; along: number } | undefined): { offset: number; along: number } {
  if (val === undefined || val === 0) return { offset: 0, along: 0.5 };
  if (typeof val === 'number') return { offset: val, along: 0.5 };
  return val;
}

/** Trace the INNER wall path (inset by wall thickness).
 *  Counter-clockwise winding so evenodd fill creates a hole when combined with the outer path.
 *  Does NOT call beginPath() — must be called after traceShapePath on the same context. */
export function traceInnerPath(ctx: PathCtxNoBegin, sw: number, sh: number, curves: Record<string, { offset: number; along: number } | number> | undefined, scale: number, wallPx: number, geometry?: string) {
  const w = wallPx;

  if (geometry === 'circle') {
    const cx = sw / 2, cy = sh / 2;
    const r = Math.min(sw, sh) / 2 - w;
    if (r > 0) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); }
    ctx.closePath();
    return;
  }

  if (geometry === 'semicircle') {
    const cx = sw / 2, cy = sh;
    const r = Math.min(sw / 2, sh) - w;
    if (r > 0) { ctx.moveTo(cx - r, cy - w); ctx.arc(cx, cy, r, Math.PI, 0, true); ctx.lineTo(cx + r, cy - w); }
    ctx.closePath();
    return;
  }

  const top = parseWallCurve(curves?.top);
  const right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom);
  const left = parseWallCurve(curves?.left);

  ctx.moveTo(w, w);
  if (left.offset) { ctx.quadraticCurveTo(-left.offset * scale + w, (sh - 2 * w) * (1 - left.along) + w, w, sh - w); } else { ctx.lineTo(w, sh - w); }
  if (bottom.offset) { ctx.quadraticCurveTo((sw - 2 * w) * (1 - bottom.along) + w, sh + bottom.offset * scale - w, sw - w, sh - w); } else { ctx.lineTo(sw - w, sh - w); }
  if (right.offset) { ctx.quadraticCurveTo(sw + right.offset * scale - w, (sh - 2 * w) * right.along + w, sw - w, w); } else { ctx.lineTo(sw - w, w); }
  if (top.offset) { ctx.quadraticCurveTo((sw - 2 * w) * top.along + w, -top.offset * scale + w, w, w); } else { ctx.lineTo(w, w); }
  ctx.closePath();
}

/** Trace just the inner path as a standalone path (with beginPath). Used for grid clipping. */
export function traceInnerPathStandalone(ctx: PathCtx, sw: number, sh: number, curves: Record<string, { offset: number; along: number } | number> | undefined, scale: number, wallPx: number, geometry?: string) {
  const w = wallPx;
  ctx.beginPath();

  if (geometry === 'circle') {
    const cx = sw / 2, cy = sh / 2;
    const r = Math.min(sw, sh) / 2 - w;
    if (r > 0) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
    ctx.closePath();
    return;
  }

  if (geometry === 'semicircle') {
    const cx = sw / 2, cy = sh;
    const r = Math.min(sw / 2, sh) - w;
    if (r > 0) { ctx.moveTo(cx + r, cy - w); ctx.arc(cx, cy, r, 0, Math.PI); ctx.lineTo(cx - r, cy - w); }
    ctx.closePath();
    return;
  }

  const top = parseWallCurve(curves?.top);
  const right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom);
  const left = parseWallCurve(curves?.left);

  ctx.moveTo(w, w);
  if (top.offset) { ctx.quadraticCurveTo((sw - 2 * w) * top.along + w, -top.offset * scale + w, sw - w, w); } else { ctx.lineTo(sw - w, w); }
  if (right.offset) { ctx.quadraticCurveTo(sw + right.offset * scale - w, (sh - 2 * w) * right.along + w, sw - w, sh - w); } else { ctx.lineTo(sw - w, sh - w); }
  if (bottom.offset) { ctx.quadraticCurveTo((sw - 2 * w) * (1 - bottom.along) + w, sh + bottom.offset * scale - w, w, sh - w); } else { ctx.lineTo(w, sh - w); }
  if (left.offset) { ctx.quadraticCurveTo(-left.offset * scale + w, (sh - 2 * w) * (1 - left.along) + w, w, w); } else { ctx.lineTo(w, w); }
  ctx.closePath();
}

/** Build the shape path on a canvas context. Used for both clipFunc and border sceneFunc. */
export function traceShapePath(ctx: PathCtx, sw: number, sh: number, curves: Record<string, { offset: number; along: number } | number> | undefined, scale: number, geometry?: string) {
  ctx.beginPath();

  if (geometry === 'circle') {
    const cx = sw / 2, cy = sh / 2, r = Math.min(sw, sh) / 2;
    ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    return;
  }

  if (geometry === 'semicircle') {
    const cx = sw / 2, cy = sh, r = Math.min(sw / 2, sh);
    ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI); ctx.closePath();
    return;
  }

  const top = parseWallCurve(curves?.top);
  const right = parseWallCurve(curves?.right);
  const bottom = parseWallCurve(curves?.bottom);
  const left = parseWallCurve(curves?.left);

  ctx.moveTo(0, 0);
  if (top.offset) { ctx.quadraticCurveTo(sw * top.along, -top.offset * scale, sw, 0); } else { ctx.lineTo(sw, 0); }
  if (right.offset) { ctx.quadraticCurveTo(sw + right.offset * scale, sh * right.along, sw, sh); } else { ctx.lineTo(sw, sh); }
  if (bottom.offset) { ctx.quadraticCurveTo(sw * (1 - bottom.along), sh + bottom.offset * scale, 0, sh); } else { ctx.lineTo(0, sh); }
  if (left.offset) { ctx.quadraticCurveTo(-left.offset * scale, sh * (1 - left.along), 0, 0); } else { ctx.lineTo(0, 0); }
  ctx.closePath();
}
