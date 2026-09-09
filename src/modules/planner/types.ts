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
  /** Operational text shown on the card (carried from a template). Optional. */
  plan?: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Minutes from local midnight. */
  startMin: number;
  durationMin: number;
}

/**
 * A TEMPLATE event: a date-agnostic, daily-recurring program item. Unlike a
 * PlannerEvent it has no `date` — a template applies to EVERY day of a
 * retreat. `kind` is the visual/booking type (yoga, meal, spa, …). Applying a
 * template to a retreat's date range materialises each item into dated
 * PlannerEvents, one per day (see materializeTemplate in ./template).
 */
export interface TemplateEvent {
  id: string;
  kind: BookingType;
  title: string;
  /** Minutes from local midnight. */
  startMin: number;
  durationMin: number;
  description?: string;
  /** Operational text shown on the card. Optional for now. */
  plan?: string;
  layer?: EventLayer;
}

/** A saved planner template row (planner_templates). */
export interface PlannerTemplate {
  id: string;
  name: string;
  description: string | null;
  events: TemplateEvent[];
  is_standard: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Lifecycle state of a retreat's experience plan. */
export type ExperiencePlanStatus = 'draft' | 'approved';

/** A saved per-retreat experience plan row (experience_plans). */
export interface ExperiencePlan {
  id: string;
  retreat_id: string;
  name: string | null;
  events: PlannerEvent[];
  source_template_id: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

/** A retreat as shown in the planner's picker. */
export interface PlannerRetreat {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

/** Which kind of thing the planner is currently editing. */
export type PlannerMode = 'template' | 'plan';
