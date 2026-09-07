/**
 * Is this retreat a Yoga Teacher Training?
 *
 * Two signals, because neither alone is reliable:
 *   1. The `ytt` category in AO. Correct where it is set, but staff
 *      tag inconsistently — several trainings carry only `yoga` or
 *      `special` instead.
 *   2. The retreat name. Catches the untagged ones ("200 Hr Yoga
 *      Teacher Training", "... Facilitation Training").
 *
 * Deliberately generous: a false positive puts an extra badge on a
 * dashboard row, while a false negative hides the thing Geoff asked to
 * be able to spot at a glance.
 */
const NAME_PATTERNS = [
  'teacher training',
  'yoga teacher',
  'ytt',
  '200 hr',
  '200hr',
  '300 hr',
  '300hr',
  '500 hr',
  '500hr',
];

// Deliberately NOT matched: "Facilitation Training", "FSM Training",
// "Immersion". Those are real trainings but not yoga teacher trainings,
// and a wrong lotus badge is worse than none. Staff can tag them `ytt`
// in AO if they ever should count.


export function isYtt(
  name: string | null | undefined,
  categories: string[] | null | undefined,
): boolean {
  if ((categories ?? []).some((c) => (c ?? '').toLowerCase().trim() === 'ytt')) return true;
  const n = (name ?? '').toLowerCase();
  if (!n) return false;
  return NAME_PATTERNS.some((p) => n.includes(p));
}
