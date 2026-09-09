import type { ProgrammingSlot } from './types';

/**
 * Standard Anamaya daily program — EDITABLE.
 *
 * These are the fixed meals + group yoga sessions that repeat every day and
 * render as the ambient "programming" background layer on the planner. Adjust
 * the times here (minutes from midnight) or add/remove slots to change the
 * house schedule for the whole property.
 *
 * NOTE: `kind` drives the tint ('yoga' vs 'meal'). `titleKey` is an i18n key.
 */
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

export const DEFAULT_SCHEDULE: ProgrammingSlot[] = [
  { id: 'morning-yoga', titleKey: 'experience.planner.prog.morningYoga', kind: 'yoga', startMin: h(7), endMin: h(8, 30) },
  { id: 'breakfast', titleKey: 'experience.planner.prog.breakfast', kind: 'meal', startMin: h(8, 30), endMin: h(9, 30) },
  { id: 'lunch', titleKey: 'experience.planner.prog.lunch', kind: 'meal', startMin: h(13), endMin: h(14) },
  { id: 'evening-yoga', titleKey: 'experience.planner.prog.eveningYoga', kind: 'yoga', startMin: h(16, 30), endMin: h(18) },
  { id: 'dinner', titleKey: 'experience.planner.prog.dinner', kind: 'meal', startMin: h(18, 30), endMin: h(19, 30) },
];
