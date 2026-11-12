import type { TranslationKeys } from '@/i18n/en';

/**
 * Dictionary lookups, as PLAIN DATA.
 *
 * Two constraints shape this file, and both are easy to trip over.
 *
 * 1. NO FUNCTIONS ON THIS OBJECT. Half the panels are client components
 *    and this object is built on the server and handed to them as a
 *    prop. React cannot serialise a function across that boundary and
 *    fails the whole render with "Functions cannot be passed directly to
 *    Client Components". So every lookup here is a resolved record, and
 *    the one helper (`tx`) is imported by the panels rather than carried
 *    on the object.
 *
 * 2. EVERY LOOKUP IS RUNTIME-SAFE. Labels are keyed by runtime values --
 *    a metric id, a format slug, a weekday number -- so they have to be
 *    read dynamically. Indexing a dictionary namespace with a computed
 *    key only typechecks while every key beneath it happens to be a
 *    string, and breaks silently the moment someone nests an object
 *    under it. That has bitten this codebase before. `flat()` below
 *    keeps only the string values, so a nested object can never leak
 *    into a label and render as "[object Object]".
 */

type Unknown = Record<string, unknown>;

/** Keep only the string-valued keys of a dictionary node. */
function flat(node: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Unknown)) {
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

function child(node: unknown, key: string): unknown {
  return node && typeof node === 'object' ? (node as Unknown)[key] : undefined;
}

/** Read a label, falling back to the key rather than rendering nothing. */
export function tx(
  scope: Record<string, string> | undefined, key: string, fallback?: string,
): string {
  return scope?.[key] ?? fallback ?? key;
}

export interface SocialLabels {
  /** Top-level strings: title, subtitle, tab names, empty states. */
  top: Record<string, string>;
  range: Record<string, string>;
  metric: Record<string, string>;
  format: Record<string, string>;
  /** Indexed 0..6, Monday first, matching `byPostingTime`. */
  day: string[];
  band: Record<string, string>;
  kpiDir: { up: string; down: string; flat: string; vsPrev: string };
  common: { empty: string; noData: string; posts: string };
  sampleBanner: Record<string, string>;
  /** One record per panel. Nested groups are hoisted to their own keys. */
  panels: Record<string, Record<string, string>>;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function socialLabels(dict: TranslationKeys): SocialLabels {
  const s = dict.social as unknown;
  const panelsNode = child(s, 'panels');
  const days = flat(child(s, 'day'));

  const panels: Record<string, Record<string, string>> = {};
  if (panelsNode && typeof panelsNode === 'object') {
    for (const [name, node] of Object.entries(panelsNode as Unknown)) {
      panels[name] = flat(node);
    }
  }
  // The funnel's step and reason text is nested a level deeper, so hoist
  // each group to its own flat record rather than reaching into it.
  panels.funnelSteps = flat(child(child(panelsNode, 'funnel'), 'steps'));
  panels.funnelBlocked = flat(child(child(panelsNode, 'funnel'), 'blocked'));

  const kpi = flat(child(s, 'kpi'));
  const top = flat(s);

  return {
    top,
    range: flat(child(s, 'range')),
    metric: flat(child(s, 'metric')),
    format: flat(child(s, 'format')),
    day: DAY_KEYS.map((k) => days[k] ?? k),
    band: flat(child(s, 'band')),
    kpiDir: {
      up: kpi.up ?? 'up', down: kpi.down ?? 'down',
      flat: kpi.flat ?? 'no change', vsPrev: kpi.vsPrev ?? '',
    },
    common: {
      empty: top.empty ?? 'Unclassified',
      noData: top.noData ?? 'No data',
      posts: top.posts ?? 'posts',
    },
    sampleBanner: flat(child(s, 'sampleBanner')),
    panels,
  };
}

/** Weekday order used by every grid here: Monday first. */
export const DAY_ORDER = [0, 1, 2, 3, 4, 5, 6];

/** Four-hour band starts. Keys match `social.band.b*`. */
export const HOUR_BANDS = ['0', '4', '8', '12', '16', '20'];
