import { createServiceClient } from '@/lib/supabase/server';
import type { LodgingAvailability } from '@/lib/retreat-availability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/upcoming-retreats?limit=3&min_days=7
 *
 * PUBLIC, read-only feed for anamaya.com, the rebuild and any other site.
 * Returns the next public retreats that start at least `min_days` from today
 * (Costa Rica date) and still have space, with which room types are open.
 * Only marketing-safe columns are selected; no bookings or people data.
 *
 * "Has space" = not manually marked sold out, RG's capacity flag isn't false,
 * and (if we could read the booking form) at least one room type is open.
 * Availability is refreshed hourly by /api/cron/retreat-availability.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const SITE = 'https://www.anamaya.com';

interface Row {
  rg_id: number | null;
  name: string;
  start_date: string;
  end_date: string | null;
  tagline: string | null;
  excerpt: string | null;
  external_link: string | null;
  website_slug: string | null;
  registration_link: string | null;
  registration_status: string | null;
  feature_image_url: string | null;
  images: Record<string, { url?: string }> | null;
  is_sold_out: boolean | null;
  rg_has_capacity: boolean | null;
  lodging_availability: LodgingAvailability[] | null;
  availability_checked_at: string | null;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8211;|&ndash;/g, '–')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/<[^>]+>/g, '').trim();

/** "The Sacred Reset Retreat – Karen Love" -> title + leader. */
function splitName(name: string): { title: string; leader: string | null } {
  const m = decode(name).match(/^(.*\S)\s+[-–—]\s+([^-–—]+)$/);
  return m ? { title: m[1], leader: m[2].trim() } : { title: decode(name), leader: null };
}

function pageUrl(r: Row): string | null {
  if (r.external_link) {
    try {
      const u = new URL(r.external_link);
      if (u.hostname.endsWith('anamaya.com')) return `${SITE}${u.pathname}`;
      return r.external_link;
    } catch { /* fall through */ }
  }
  return r.website_slug ? `${SITE}/retreat/${r.website_slug}/` : null;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const limit = Math.min(12, Math.max(1, Number(q.get('limit')) || 3));
  const minDays = Math.min(365, Math.max(0, Number(q.get('min_days') ?? 7) || 0));
  const from = new Date(Date.now() - 6 * 3600_000 + minDays * 86400_000).toISOString().slice(0, 10);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('retreats')
    .select('rg_id, name, start_date, end_date, tagline, excerpt, external_link, website_slug, registration_link, registration_status, feature_image_url, images, is_sold_out, rg_has_capacity, lodging_availability, availability_checked_at')
    .eq('is_public', true)
    .eq('is_active', true)
    .or('is_private_retreat.is.null,is_private_retreat.eq.false')
    .gte('start_date', from)
    .order('start_date', { ascending: true })
    .limit(60);
  if (error) return Response.json({ error: 'unavailable' }, { status: 503, headers: CORS });

  const retreats = ((data ?? []) as Row[])
    .filter((r) => r.is_sold_out !== true && r.rg_has_capacity !== false)
    .filter((r) => !r.lodging_availability?.length || r.lodging_availability.some((l) => l.available))
    .slice(0, limit)
    .map((r) => {
      const { title, leader } = splitName(r.name);
      const lodging = r.lodging_availability ?? null;
      const open = lodging?.filter((l) => l.available) ?? null;
      const prices = (open ?? []).map((l) => l.price).filter((p): p is number => typeof p === 'number' && p > 0);
      const nights = r.end_date ? Math.round((Date.parse(r.end_date) - Date.parse(r.start_date)) / 86400_000) : null;
      return {
        id: r.rg_id,
        title,
        leader,
        start_date: r.start_date,
        end_date: r.end_date,
        nights,
        tagline: r.tagline ? decode(r.tagline) : null,
        image: r.images?.large?.url ?? r.images?.full?.url ?? r.feature_image_url ?? null,
        url: pageUrl(r),
        booking_url: r.registration_link,
        rooms_open: open?.map((l) => ({ name: l.name, price: l.price })) ?? null,
        rooms_total: lodging?.length ?? null,
        from_price: prices.length ? Math.min(...prices) : null,
        availability_checked_at: r.availability_checked_at,
      };
    });

  return Response.json(
    { generated_at: new Date().toISOString(), min_days: minDays, retreats },
    { headers: { ...CORS, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } },
  );
}
