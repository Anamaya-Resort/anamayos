import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import type { GreenAirConfig, SearchParams, SearchResult } from './types';
import { FALLBACK_CONFIG, readConfig, searchFlights } from './zenith';

/** Prices are reused for 15 minutes per exact search (route, dates, passengers). */
export const SEARCH_CACHE_SECONDS = 15 * 60;

/** Airports and routes rarely change: re-read once a day. */
export const getConfig = unstable_cache(
  async (): Promise<GreenAirConfig> => {
    try {
      return await readConfig();
    } catch {
      return FALLBACK_CONFIG;
    }
  },
  ['greenair-config-v1'],
  { revalidate: 24 * 3600 },
);

const cachedSearch = unstable_cache(
  async (p: SearchParams): Promise<SearchResult> => searchFlights(p, await getConfig()),
  ['greenair-search-v1'],
  { revalidate: SEARCH_CACHE_SECONDS },
);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const searchSchema = z
  .object({
    from: z.string().regex(/^[A-Z]{3}$/),
    to: z.string().regex(/^[A-Z]{3}$/),
    depart: day,
    return: day.optional(),
    adults: z.coerce.number().int().min(1).max(9),
  })
  .refine((p) => !p.return || p.return >= p.depart, { message: 'Return is before departure' });

/** Costa Rica's date today (UTC-6, no daylight saving). */
export function crToday(): string {
  return new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
}

export async function search(p: SearchParams): Promise<SearchResult> {
  const cfg = await getConfig();
  if (!cfg.routes[p.from]?.includes(p.to)) throw new RangeError('Green Airways does not fly that route');
  if (p.depart < crToday()) throw new RangeError('That date has passed');
  // Normalise so equal searches share one cache entry.
  return cachedSearch({ from: p.from, to: p.to, depart: p.depart, adults: p.adults, ...(p.return ? { return: p.return } : {}) });
}
