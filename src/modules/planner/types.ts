/** Planner domain types. */

/** Which visual layer a fixed programming slot belongs to. */
export type ProgrammingKind = 'yoga' | 'meal';

/** Booking-layer block types. Each renders as a solid card on top. */
export type BookingType = 'spa' | 'excursion' | 'other' | 'meal' | 'yoga' | 'custom';

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
 * A booking-layer event (spa / excursion / other / custom). Rendered as a
 * solid card ON TOP of the programming bands — overlap is expected and allowed.
 */
export interface PlannerEvent {
  id: string;
  title: string;
  type: BookingType;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Minutes from local midnight. */
  startMin: number;
  durationMin: number;
}
