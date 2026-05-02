import type { Locale } from '@/config/app';

const MONTHS_BY_LOCALE: Record<Locale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
};

/** Format a date as `YYYY-Mon-DD` (e.g. 2026-May-25 / 2026-Ene-25). */
export function formatDate(input: string | Date | null | undefined, locale: Locale = 'en'): string {
  if (!input) return '—';
  const s = typeof input === 'string' ? input : input.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(input);
  const [, y, mm, dd] = m;
  const monthIdx = parseInt(mm, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return String(input);
  const months = MONTHS_BY_LOCALE[locale] ?? MONTHS_BY_LOCALE.en;
  return `${y}-${months[monthIdx]}-${dd}`;
}

/** Format as `Mon-DD` (no year). Useful in compact ranges like "May-21 — May-28". */
export function formatDateShort(input: string | Date | null | undefined, locale: Locale = 'en'): string {
  if (!input) return '—';
  const s = typeof input === 'string' ? input : input.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(input);
  const [, , mm, dd] = m;
  const monthIdx = parseInt(mm, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return String(input);
  const months = MONTHS_BY_LOCALE[locale] ?? MONTHS_BY_LOCALE.en;
  return `${months[monthIdx]}-${dd}`;
}

/** Format a date range. If years differ, both years shown; otherwise year shown only at end. */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined, locale: Locale = 'en'): string {
  if (!start && !end) return '—';
  if (!start) return formatDate(end, locale);
  if (!end) return formatDate(start, locale);
  const sy = start.slice(0, 4);
  const ey = end.slice(0, 4);
  if (sy === ey) {
    return `${formatDateShort(start, locale)} — ${formatDate(end, locale)}`;
  }
  return `${formatDate(start, locale)} — ${formatDate(end, locale)}`;
}
