import type { ColorSlot, PostFormat } from './types';

/**
 * The styling layer. Nothing in this module writes a colour; everything
 * asks here, and here returns a CSS custom property.
 *
 * How to restyle, in order of reach:
 *
 * 1. Light / dark — already done. Every token below resolves to a var
 *    that `src/app/globals.css` redefines under `.dark`.
 * 2. A white-label client — add a `[data-tenant="slug"]` block in
 *    globals.css overriding `--brand-*` and `--chart-1..8`. Every chart,
 *    tile, table and heatmap in this module repaints. No code change.
 * 3. One pillar or campaign — change its `color_slot` / `accent_slot` in
 *    the database. Data, not code.
 *
 * The one hard rule: a hex value must never appear in a component in
 * this module. If you need a shade, derive it with `mix()` so it still
 * follows the theme in dark mode and under a tenant override.
 */

/** Resolve a theme slot to its CSS variable reference. */
export const slotVar = (slot: ColorSlot | number): string =>
  `var(--chart-${((Math.max(1, Math.round(slot)) - 1) % 8) + 1})`;

/**
 * Blend a themed colour toward the card surface.
 *
 * Used for sequential ramps (the heatmap) and for recessive fills. Goes
 * through the surface token rather than toward white, so a dark theme
 * fades to dark instead of washing out.
 */
export const mix = (color: string, pct: number): string =>
  `color-mix(in oklab, ${color} ${Math.round(Math.min(100, Math.max(0, pct)))}%, var(--card))`;

/** Shared, themed token names used across the charts. */
export const CHART_TOKENS = {
  surface: 'var(--card)',
  ink: 'var(--foreground)',
  inkMuted: 'var(--muted-foreground)',
  grid: 'var(--border)',
  axis: 'var(--border)',
  track: 'var(--muted)',
  accent: 'var(--primary)',
} as const;

/**
 * A sequential ramp from one themed hue, for heatmaps.
 *
 * Single hue, light to dark, which is the only correct choice for
 * magnitude. Never a rainbow: a rainbow implies categories where there
 * are none and hides the ordering.
 */
export function rampStep(slot: ColorSlot | number, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  // Floor of 8% so an occupied-but-tiny cell still reads as occupied
  // rather than as empty.
  return mix(slotVar(slot), 8 + clamped * 82);
}

/**
 * Ink that stays legible on a ramped cell. Past roughly the midpoint the
 * fill is dark enough that foreground ink fails, so flip to the surface
 * colour instead of hoping.
 */
export const rampInk = (t: number): string =>
  t > 0.55 ? CHART_TOKENS.surface : CHART_TOKENS.ink;

/** Shared geometry, so every chart in the module lines up. */
export interface Geometry {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const GEO: Geometry = {
  width: 1000,
  height: 320,
  left: 56,
  right: 20,
  top: 20,
  bottom: 48,
};

export const plotWidth = (g: Geometry = GEO) => g.width - g.left - g.right;
export const plotHeight = (g: Geometry = GEO) => g.height - g.top - g.bottom;

/** Format slugs to i18n keys. Labels themselves live in the dictionary. */
export const FORMAT_ORDER: PostFormat[] = ['reel', 'carousel', 'image', 'story'];

/**
 * Icon-free, colour-free format marker.
 *
 * Formats are distinguished by their written label everywhere in this
 * module, never by colour alone -- see the note on slots 6-8 in
 * globals.css for why.
 */
export const formatLabelKey = (f: PostFormat): string => f;
