import type { PlannerEvent, BookingType } from './types';

/** Geometry constants for the time grid. */
export const ROW_MIN = 15; // one grid row = 15 minutes
export const PX_PER_MIN = 0.8; // 12px per 15-min row
export const DAY_MINUTES = 24 * 60;
export const GRID_HEIGHT = DAY_MINUTES * PX_PER_MIN; // 1152px
export const ROW_HEIGHT = ROW_MIN * PX_PER_MIN; // 12px
export const ROWS_PER_DAY = DAY_MINUTES / ROW_MIN; // 96

/** Bright working window: 5:00 AM to 10:00 PM. Outside = darkened band. */
export const WORK_START_MIN = 5 * 60;
export const WORK_END_MIN = 22 * 60;

/** Convert minutes-from-midnight to a pixel offset in the grid. */
export const minToPx = (min: number) => min * PX_PER_MIN;

/** Date helpers (all string-based, local, YYYY-MM-DD). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMonths(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setMonth(d.getMonth() + n);
  return toDateStr(d);
}

/** Sunday that starts the week containing dateStr. */
export function startOfWeek(dateStr: string): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return toDateStr(d);
}

/** The 7 dates (Sun..Sat) of the week containing dateStr. */
export function weekDates(dateStr: string): string[] {
  const start = startOfWeek(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * The grid of dates for a month view: full weeks (Sun-start) covering the
 * month containing dateStr, so 5-6 rows of 7.
 */
export function monthGridDates(dateStr: string): string[] {
  const d = parseDate(dateStr);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const totalDays = first.getDay() + last.getDate();
  const weeks = Math.ceil(totalDays / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const dd = new Date(gridStart);
    dd.setDate(gridStart.getDate() + i);
    return toDateStr(dd);
  });
}

export function monthOf(dateStr: string): number {
  return parseDate(dateStr).getMonth();
}

export function dayOfMonth(dateStr: string): number {
  return parseDate(dateStr).getDate();
}

export function weekdayIndex(dateStr: string): number {
  return parseDate(dateStr).getDay();
}

/** Current minutes-from-midnight, or null when dateStr is not today. */
export function nowMinutesIfToday(dateStr: string): number | null {
  if (dateStr !== todayStr()) return null;
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** Round a raw minute value down to the nearest 15-min grid row. */
export function snapToRow(min: number): number {
  return Math.floor(min / ROW_MIN) * ROW_MIN;
}

/**
 * Lay overlapping events into side-by-side lanes so none are hidden.
 * Returns per-event { lane, lanes } for width/left calculation.
 */
export function computeLanes(
  events: PlannerEvent[],
): Map<string, { lane: number; lanes: number }> {
  const result = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin,
  );

  let cluster: PlannerEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();
    for (const ev of cluster) {
      let placed = -1;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= ev.startMin) {
          placed = i;
          break;
        }
      }
      if (placed === -1) {
        placed = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[placed] = ev.startMin + ev.durationMin;
      laneOf.set(ev.id, placed);
    }
    const lanes = laneEnds.length;
    for (const ev of cluster) {
      result.set(ev.id, { lane: laneOf.get(ev.id) ?? 0, lanes });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.startMin >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.startMin + ev.durationMin);
  }
  flush();

  return result;
}

/** Solid-card colour per booking type (CSS var strings). */
export function bookingColor(type: BookingType): { bg: string; border: string } {
  switch (type) {
    case 'spa':
      return { bg: 'var(--brand-btn)', border: 'var(--brand-btn-hover)' };
    case 'excursion':
      return { bg: 'var(--brand-highlight)', border: '#7d9a3a' };
    case 'meal':
      return { bg: 'var(--info)', border: '#2563eb' };
    case 'yoga':
      return { bg: '#8b5cf6', border: '#6d28d9' };
    case 'custom':
      return { bg: 'var(--brand-muted)', border: '#5f5f5f' };
    default:
      return { bg: '#0d9488', border: '#0f766e' };
  }
}
