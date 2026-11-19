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
