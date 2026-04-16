// ============================================================
// Room Builder — Layout JSON types
// ============================================================

/** Shape type in the room layout */
export type LayoutShapeType = 'room' | 'bathroom' | 'deck' | 'loft';

/** A drawn shape (rectangle, possibly with curved walls) */
export interface LayoutShape {
  id: string;
  type: LayoutShapeType;
  x: number;          // meters from origin
  y: number;
  width: number;      // meters
  depth: number;      // meters
  rotation: number;   // degrees
  curve: { controlX: number; controlY: number } | null;
  /** Per-wall arc: offset = perpendicular distance (meters), along = 0-1 position on wall (0.5 = center/symmetric) */
  wallCurves?: Record<string, { offset: number; along: number } | number>;
}

/** A bed placed on the canvas */
export interface LayoutBedPlacement {
  id: string;
  bedId: string;       // FK to beds.id
  x: number;           // meters
  y: number;
  rotation: number;    // degrees
  splitKingPairId: string | null;  // id of paired LayoutBedPlacement
}

/** A text label on the canvas */
export interface LayoutLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
}

/** The full layout JSON stored in room_layouts.layout_json */
export interface LayoutJson {
  shapes: LayoutShape[];
  beds: LayoutBedPlacement[];
  labels: LayoutLabel[];
}

/** Display unit for the builder */
export type LayoutUnit = 'meters' | 'feet';

/** Room layout DB row */
export interface RoomLayout {
  id: string;
  room_id: string;
  layout_json: LayoutJson;
  unit: LayoutUnit;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Bed preset dimensions (always in meters)
// ============================================================

export interface BedPreset {
  type: string;        // matches BedType
  label: string;       // display name
  width: number;       // meters
  length: number;      // meters
  capacity: number;
  pillows: number;     // 1 or 2
}

export const BED_PRESETS: BedPreset[] = [
  { type: 'single',      label: 'Single',      width: 1.00, length: 1.90, capacity: 1, pillows: 1 },
  { type: 'single_long', label: 'Single Long',  width: 1.00, length: 2.00, capacity: 1, pillows: 1 },
  { type: 'bunk_bottom', label: 'Bunk Bottom',  width: 1.00, length: 1.90, capacity: 1, pillows: 1 },
  { type: 'bunk_top',    label: 'Bunk Top',     width: 1.00, length: 1.90, capacity: 1, pillows: 1 },
  { type: 'double',      label: 'Double',       width: 1.35, length: 2.00, capacity: 2, pillows: 2 },
  { type: 'queen',       label: 'Queen',        width: 1.52, length: 2.00, capacity: 2, pillows: 2 },
  { type: 'king',        label: 'King',         width: 2.00, length: 2.00, capacity: 2, pillows: 2 },
];

// ============================================================
// Constants
// ============================================================

/** Pixels per meter at zoom=1 */
export const BASE_SCALE = 80;

/** Meters to feet conversion */
export const M_TO_FT = 3.28084;
export const FT_TO_M = 1 / M_TO_FT;
