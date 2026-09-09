import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { PlannerViewMode } from './types';
import { parseDate, weekDates } from './utils';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_ABBR_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];
const MONTH_FULL_KEYS = [
  'january', 'february', 'march', 'april', 'mayFull', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function weekdayAbbr(dict: TranslationKeys, dateStr: string): string {
  return t(dict, `calendar.${WEEKDAY_KEYS[parseDate(dateStr).getDay()]}`);
}

export function monthAbbr(dict: TranslationKeys, dateStr: string): string {
  return t(dict, `calendar.${MONTH_ABBR_KEYS[parseDate(dateStr).getMonth()]}`);
}

export function monthFull(dict: TranslationKeys, dateStr: string): string {
  return t(dict, `calendar.${MONTH_FULL_KEYS[parseDate(dateStr).getMonth()]}`);
}

/** Hour axis label, e.g. "5 AM" / "12 PM", localised AM/PM. */
export function hourLabel(dict: TranslationKeys, hour: number): string {
  const period =
    hour < 12
      ? t(dict, 'experience.planner.am')
      : t(dict, 'experience.planner.pm');
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h} ${period}`;
}

/** Compact clock time from minutes-from-midnight, e.g. "9:15 AM". */
export function minuteToClock(dict: TranslationKeys, min: number): string {
  const hour = Math.floor(min / 60);
  const mm = min % 60;
  const period =
    hour < 12
      ? t(dict, 'experience.planner.am')
      : t(dict, 'experience.planner.pm');
  let h = hour % 12;
  if (h === 0) h = 12;
  return mm === 0
    ? `${h} ${period}`
    : `${h}:${String(mm).padStart(2, '0')} ${period}`;
}

/** The visible date-range label for the header, per view mode. */
export function rangeLabel(
  dict: TranslationKeys,
  view: PlannerViewMode,
  anchor: string,
): string {
  const d = parseDate(anchor);
  if (view === 'day') {
    return `${weekdayAbbr(dict, anchor)}, ${monthAbbr(dict, anchor)} ${d.getDate()}, ${d.getFullYear()}`;
  }
  if (view === 'month') {
    return `${monthFull(dict, anchor)} ${d.getFullYear()}`;
  }
  const week = weekDates(anchor);
  const last = week.length - 1;
  const firstD = parseDate(week[0]);
  const lastD = parseDate(week[last]);
  const startLabel = `${monthAbbr(dict, week[0])} ${firstD.getDate()}`;
  const endLabel =
    firstD.getMonth() === lastD.getMonth()
      ? `${lastD.getDate()}`
      : `${monthAbbr(dict, week[last])} ${lastD.getDate()}`;
  return `${startLabel} - ${endLabel}, ${lastD.getFullYear()}`;
}
