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
  /** Title text rendered at center of shape */
  titleText?: string;
  /** Title offset from center as fraction of shape dimensions (-0.5 to 0.5) */
  titleOffsetX?: number;
  titleOffsetY?: number;
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

/** A text label on the canvas (info text) */
export interface LayoutLabel {
  id: string;
  text: string;
  x: number;           // meters (absolute)
  y: number;
  rotation: number;
  fontSize: number;    // meters (scaled with zoom)
}

/** A furniture item placed on the canvas */
export interface LayoutFurniture {
  id: string;
  type: string;        // 'desk' | 'nightstand' | 'shelves' | 'planter'
  label: string;
  x: number;           // meters
  y: number;
  width: number;       // meters
  depth: number;       // meters
  rotation: number;
}

/** Resort-level config for fonts and sizes */
/** Per-text-type styling */
export interface TextStyle {
  fontFamily: string;
  fontSize: number;       // meters
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  color: string;          // hex
}

export interface ResortConfig {
  title: TextStyle;       // Room title text
  info: TextStyle;        // Info text (T tool labels)
  furniture: TextStyle;   // Furniture labels
}

export const DEFAULT_RESORT_CONFIG: ResortConfig = {
  title:     { fontFamily: 'Arial', fontSize: 0.3,  fontStyle: 'bold',   color: '#44403c' },
  info:      { fontFamily: 'Arial', fontSize: 0.2,  fontStyle: 'normal', color: '#44403c' },
  furniture: { fontFamily: 'Arial', fontSize: 0.15, fontStyle: 'normal', color: '#78716c' },
};

/** The full layout JSON stored in room_layouts.layout_json */
export interface LayoutJson {
  shapes: LayoutShape[];
  beds: LayoutBedPlacement[];
  labels: LayoutLabel[];
  furniture?: LayoutFurniture[];
  resortConfig?: ResortConfig;
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
  type: string;
  label: string;
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
// Furniture presets
// ============================================================

export interface FurniturePreset {
  type: string;
  label: string;
  width: number;       // meters
  depth: number;       // meters
  icon: string;
}

export const FURNITURE_PRESETS: FurniturePreset[] = [
  { type: 'desk',        label: 'Desk',        width: 1.20, depth: 0.60, icon: '🪑' },
  { type: 'nightstand',  label: 'Nightstand',  width: 0.50, depth: 0.50, icon: '🗄' },
  { type: 'shelves',     label: 'Shelves',     width: 1.00, depth: 0.30, icon: '📚' },
  { type: 'planter',     label: 'Planter',     width: 0.40, depth: 0.40, icon: '🌿' },
];

// ============================================================
// Constants
// ============================================================

/** Pixels per meter at zoom=1 */
export const BASE_SCALE = 80;

/** Meters to feet conversion */
export const M_TO_FT = 3.28084;
export const FT_TO_M = 1 / M_TO_FT;

/** Available font families */
export const FONT_FAMILIES = [
  // System fonts
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana',
  // Google Fonts (loaded on demand)
  'Inter', 'Roboto', 'Lato', 'Playfair Display', 'Merriweather',
  'Open Sans', 'Montserrat', 'Source Code Pro', 'Raleway', 'Nunito',
];
