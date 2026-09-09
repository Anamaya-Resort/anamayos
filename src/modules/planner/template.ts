import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent, TemplateEvent } from './types';
import { DEFAULT_SCHEDULE } from './default-schedule';
import { addDays, clampDuration } from './utils';

/** Hard cap so a bad date range can never explode the materialisation loop. */
const MAX_MATERIALIZE_DAYS = 366;

/**
 * MATERIALISE a template across a retreat's date range: every TEMPLATE event
 * becomes a concrete dated PlannerEvent on every day from startDate to
 * endDate (inclusive). Each instance is independently editable/movable on the
 * grid. Ids are stable per (templateEvent, date) so re-materialising is
 * deterministic.
 *
 * Dates are YYYY-MM-DD, local. If the range is invalid (missing or reversed)
 * nothing is produced.
 */
export function materializeTemplate(
  templateEvents: TemplateEvent[],
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): PlannerEvent[] {
  if (!startDate || !endDate || endDate < startDate) return [];

  const out: PlannerEvent[] = [];
  let date = startDate;
  let guard = 0;
  while (date <= endDate && guard < MAX_MATERIALIZE_DAYS) {
    for (const te of templateEvents) {
      out.push(materializeOne(te, date));
    }
    date = addDays(date, 1);
    guard += 1;
  }
  return out;
}

/** Materialise a single template item onto one date. */
export function materializeOne(te: TemplateEvent, date: string): PlannerEvent {
  const durationMin = clampDuration(te.startMin, te.durationMin);
  return {
    id: `plan-${te.id}-${date}`,
    title: te.title,
    type: te.kind,
    layer: te.layer ?? 'program',
    description: te.description ?? '',
    plan: te.plan,
    date,
    startMin: te.startMin,
    durationMin,
  };
}

/**
 * DE-MATERIALISE dated events back into date-agnostic TEMPLATE events — used
 * when building a template from the currently-loaded plan/events. A template
 * captures ONE representative day: we take the events of the earliest date
 * present and drop the date. (Assumption: a template is a single recurring
 * day; per-day divergence across a plan is not stored in a template.)
 */
export function templateEventsFromEvents(events: PlannerEvent[]): TemplateEvent[] {
  if (events.length === 0) return [];
  const firstDate = events.reduce(
    (min, e) => (min === null || e.date < min ? e.date : min),
    null as string | null,
  );
  return events
    .filter((e) => e.date === firstDate)
    .sort((a, b) => a.startMin - b.startMin)
    .map((e, i) => ({
      id: stripDateFromId(e.id, e.date) || `tpl-${i}`,
      kind: e.type,
      title: e.title,
      startMin: e.startMin,
      durationMin: e.durationMin,
      description: e.description || undefined,
      plan: e.plan,
      layer: e.layer,
    }));
}

/** Fallback template events built from the local DEFAULT_SCHEDULE (offline). */
export function fallbackTemplateEvents(dict: TranslationKeys): TemplateEvent[] {
  return DEFAULT_SCHEDULE.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: t(dict, s.titleKey),
    startMin: s.startMin,
    durationMin: s.endMin - s.startMin,
    layer: 'program' as const,
  }));
}

/** Materialise template items onto a specific (non-contiguous) set of dates. */
export function eventsForDates(templateEvents: TemplateEvent[], dates: string[]): PlannerEvent[] {
  return dates.flatMap((d) => templateEvents.map((te) => materializeOne(te, d)));
}

/** Recover a stable base id from a materialised id like `plan-<base>-<date>`. */
function stripDateFromId(id: string, date: string): string {
  const suffix = `-${date}`;
  let base = id.endsWith(suffix) ? id.slice(0, -suffix.length) : id;
  if (base.startsWith('plan-')) base = base.slice('plan-'.length);
  if (base.startsWith('prog-')) base = base.slice('prog-'.length);
  return base;
}
