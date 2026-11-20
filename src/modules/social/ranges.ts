/**
 * The window presets, as plain data.
 *
 * These live apart from the picker that renders them because the picker
 * is a client component, and in the App Router EVERY export of a
 * `'use client'` module becomes a client reference when a server
 * component imports it -- including plain constants. A server component
 * reading `RANGE_DAYS` from the picker therefore got a proxy rather
 * than the table, every lookup came back undefined, and every preset
 * silently fell through to the twelve-month default while still
 * highlighting the button you pressed. That is a very quiet way to be
 * wrong, so the data lives here and nothing but the picker's own markup
 * lives there.
 */
export const RANGE_DAYS: Record<string, number> = {
  '7d': 7, '30d': 30, '90d': 90, '12mo': 365,
};

export const RANGE_KEYS = ['7d', '30d', '90d', '12mo'] as const;

/** The query value that means "read from and to instead of a preset". */
export const CUSTOM_RANGE = 'custom';

/** Shown when no preset is named. */
export const DEFAULT_RANGE = '12mo';

/**
 * The timezone every window boundary is read in.
 *
 * Windows are calendar days, and a calendar day only exists inside a
 * timezone. Taking "today" from UTC rolls the window forward at 6pm in
 * Costa Rica, so an evening visit saw a window that ran a day ahead of
 * the day it was and quietly dropped the oldest day of the comparison.
 */
export const REPORT_TIME_ZONE = 'America/Costa_Rica';

/**
 * The two ways a post can be measured.
 *
 * `fair` uses each post's first `MATURITY_DAYS` days, which is the only
 * honest way to rank a post from last year beside one from Tuesday. It
 * needs daily readings covering that first week, so it has nothing to
 * say about any post published before the connector was switched on.
 * `lifetime` uses everything a post has ever earned, which makes the
 * back catalogue comparable at the cost of flattering whatever is
 * oldest. The basis is named on screen either way.
 */
export const COMPARE_BASES = ['fair', 'lifetime'] as const;
export type CompareBasis = (typeof COMPARE_BASES)[number];
export const DEFAULT_BASIS: CompareBasis = 'fair';
