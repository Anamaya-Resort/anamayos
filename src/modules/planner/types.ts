/** Planner domain types. */

/** Which visual layer a fixed programming slot belongs to. */
export type ProgrammingKind = 'yoga' | 'meal';

/** Booking-layer block types. Each renders as a translucent card. */
export type BookingType = 'spa' | 'excursion' | 'other' | 'meal' | 'yoga' | 'custom';

/**
 * Which visual layer a card belongs to. Program cards (seeded meals/yoga)
 * render behind bookings; both are translucent so overlaps show through.
 */
export type EventLayer = 'program' | 'booking';

/** Calendar view granularity. */
export type PlannerViewMode = 'day' | 'week' | 'month';

/**
 * A fixed daily-program slot (meal or group yoga). Rendered as a full-width
 * tinted background band on every day — the "programming" layer.
 */
export interface ProgrammingSlot {
  id: string;
  /** i18n key resolved against the dictionary at render time. */
  titleKey: string;
  kind: ProgrammingKind;
  /** Minutes from local midnight. */
  startMin: number;
  endMin: number;
}

/**
 * A planner card. Both the seeded daily-program items (meals / yoga) and
 * user-created bookings share this shape — each is an individually
 * movable / editable / deletable instance. The `layer` decides whether it
 * renders behind (program) or in front (booking); translucent backgrounds
 * let overlapping cards show through one another.
 */
export interface PlannerEvent {
  id: string;
  title: string;
  type: BookingType;
  layer: EventLayer;
  /** Optional free-text note, edited in the card modal. */
  description?: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Minutes from local midnight. */
  startMin: number;
  durationMin: number;
}
