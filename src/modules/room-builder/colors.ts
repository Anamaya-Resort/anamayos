/**
 * Canvas color constants for the room builder.
 *
 * Konva renders to Canvas 2D which cannot use CSS variables,
 * so these are hardcoded hex values that MATCH the global CSS vars.
 * If the brand/theme changes, update these to stay in sync.
 */

// ── Semantic interaction colors (match CSS vars) ──
/** Selection/focus blue — matches var(--info) / var(--primary) */
export const SELECT_COLOR = '#3b82f6';
/** Warning amber — matches var(--warning) */
export const WARNING_COLOR = '#f59e0b';
/** Success green — matches var(--success) */
export const SUCCESS_COLOR = '#10b981';
/** Wall fill — matches var(--brand-btn) terra cotta */
export const WALL_COLOR = '#A35B4E';

// ── Selection state colors ──
export const SELECT_BG = '#dbeafe';       // light blue bg for selected items
export const WARNING_BG = '#fef3c7';      // light amber bg for warning items

// ── Text colors ──
export const TEXT_PRIMARY = '#44403c';     // dark brown — main text
export const TEXT_SECONDARY = '#57534e';   // medium brown — labels
export const TEXT_MUTED = '#78716c';       // gray-brown — secondary info
export const TEXT_FAINT = '#a1a1aa';       // light gray — type labels
export const TEXT_DIM = '#71717a';         // dim gray — dimensions
export const TEXT_EMPTY = '#d4d4d8';       // placeholder text

// ── Grid colors ──
export const GRID_MAJOR = '#d4d4d8';
export const GRID_MINOR = '#e8e8ec';

// ── Shape fills (semantic per room type) ──
export const SHAPE_FILLS = {
  room: '#f5f5f4',
  bathroom: '#e0f2fe',
  deck: '#f5efe6',
  loft: '#fef3c7',
} as const;

export const SHAPE_STROKES = {
  room: '#78716c',
  bathroom: '#7dd3fc',
  deck: '#c4a882',
  loft: '#fcd34d',
} as const;

// ── Bed colors ──
export const BED_FILL = '#fafaf9';
export const BED_STROKE = '#78716c';
export const PILLOW_FILL = '#f5f5f4';
export const PILLOW_STROKE = '#a8a29e';

// ── Furniture colors ──
export const FURNITURE_FILL = '#f0ebe4';
export const FURNITURE_STROKE = '#c4b5a0';

// ── Opening colors ──
export const DOOR_COLOR = '#d4a9a1';
export const WINDOW_COLOR = '#9bb2c6';

// ── Canvas background ──
export const CANVAS_BG = '#ffffff';

// ── Wall thickness (meters) ──
export const WALL_THICKNESS_M = 0.15;
