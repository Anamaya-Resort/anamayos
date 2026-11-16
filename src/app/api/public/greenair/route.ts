import { BlockedError, getConfig, search, searchSchema } from '@/modules/greenair/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/greenair?from=SJO&to=ACO&depart=2026-12-05&return=2026-12-12&adults=2
 * GET /api/public/greenair            (no search: airports and routes only)
 *
 * PUBLIC, read-only Green Airways flight search for the /greenair page,
 * anamaya.com and oN1X-2. Prices are read from Green Airways' own booking
 * site and reused for 15 minutes per search. Booking always happens on
 * Green Airways' site via `bookingUrl`; we never take payment.
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

// Light per-visitor brake so nobody can use us to hammer Green Airways.
// Per server instance only, which is enough for a brake.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

const json = (body: unknown, status = 200, cache = 'no-store') =>
  Response.json(body, { status, headers: { ...CORS, 'Cache-Control': cache } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const q = Object.fromEntries(new URL(request.url).searchParams);
  if (!q.from && !q.to) return json({ config: await getConfig() }, 200, 'public, max-age=3600');

  const parsed = searchSchema.safeParse({ ...q, return: q.return || undefined });
  if (!parsed.success) return json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return json({ error: 'rate_limited' }, 429);

  try {
    const result = await search(parsed.data);
    return json(result, 200, 'public, max-age=60');
  } catch (e) {
    if (e instanceof RangeError) return json({ error: 'bad_request', detail: e.message }, 400);
    if (e instanceof BlockedError) return json({ error: 'blocked' }, 503);
    console.error('[greenair] search failed:', e);
    return json({ error: 'unavailable' }, 503);
  }
}
