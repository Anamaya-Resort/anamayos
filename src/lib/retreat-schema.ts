/**
 * Retreat GEO schema sync.
 *
 * Reads upcoming retreats from Supabase (already synced from Retreat Guru by the
 * import) and writes an Event + AggregateOffer JSON-LD block into each retreat's
 * WordPress page, via the `_anamaya_event_schema` post meta that anamaya.com
 * already auto-prints. This makes every retreat machine-readable by search
 * engines and AI agents, with real dates and a "from" price.
 *
 * Mapping to the WP page is authoritative: each retreat row carries
 * `external_link` (e.g. https://anamaya.com/retreat/<slug>/), so we derive the
 * WP post type + slug directly, no title guessing.
 *
 * Idempotent and safe to run on a schedule.
 */
import { createServiceClient } from '@/lib/supabase/server';

const WP_BASE = process.env.WP_API_BASE ?? 'https://www.anamaya.com';
const WP_USER = process.env.WP_APP_USER ?? '';
const WP_PASS = process.env.WP_APP_PASSWORD ?? '';
const EVENT_META_KEY = '_anamaya_event_schema';
// WP post types whose template prints _anamaya_event_schema. 'retreat' is
// confirmed live; add 'ytt' here once its template is verified to print it.
const SUPPORTED_TYPES = new Set(['retreat']);

type PricingOption = { name?: string; price?: number | string };

interface RetreatRow {
  rg_id: number | null;
  name: string;
  excerpt: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string | null;
  pricing_options: Record<string, PricingOption> | null;
  status: string | null;
  registration_status: string | null;
  is_sold_out: boolean | null;
  registration_link: string | null;
  external_link: string | null;
  website_slug: string | null;
  feature_image_url: string | null;
  images: { full?: { url?: string } } | null;
  location_name: string | null;
}

function stripHtml(s: string | null): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function lowestPrice(po: RetreatRow['pricing_options']): { low: number; count: number } | null {
  if (!po || typeof po !== 'object') return null;
  const prices: number[] = [];
  for (const v of Object.values(po)) {
    const raw = typeof v?.price === 'string' ? parseFloat(v.price) : v?.price;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) prices.push(raw);
  }
  if (prices.length === 0) return null;
  return { low: Math.min(...prices), count: prices.length };
}

/** Build the Event + AggregateOffer JSON-LD object for one retreat. */
export function buildEventSchema(r: RetreatRow): Record<string, unknown> | null {
  if (!r.start_date || !r.end_date) return null;
  const desc =
    stripHtml(r.excerpt) ||
    stripHtml(r.description) ||
    'A retreat at Anamaya, the clifftop wellness resort in Montezuma, Costa Rica.';
  const image = r.feature_image_url || r.images?.full?.url || undefined;

  const event: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: r.name,
    description: desc.slice(0, 300),
    startDate: r.start_date,
    endDate: r.end_date,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus:
      r.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Resort',
      name: 'Anamaya Resort',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Montezuma',
        addressRegion: 'Puntarenas',
        addressCountry: 'CR',
      },
    },
    organizer: { '@type': 'Organization', name: 'Anamaya Resort', url: 'https://www.anamaya.com/' },
  };
  if (image) event.image = image;

  const price = lowestPrice(r.pricing_options);
  const bookUrl = r.registration_link || r.external_link || undefined;
  if (price) {
    const soldOut = r.is_sold_out === true || r.registration_status === 'closed';
    const offer: Record<string, unknown> = {
      '@type': 'AggregateOffer',
      lowPrice: String(price.low),
      priceCurrency: r.currency || 'USD',
      availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    };
    if (price.count > 1) offer.offerCount = price.count;
    if (bookUrl) offer.url = bookUrl;
    event.offers = offer;
  }
  return event;
}

/** Derive the WordPress post type + slug from a retreat's external_link. */
function wpTarget(r: RetreatRow): { type: string; slug: string } | null {
  const m = (r.external_link ?? '').match(/anamaya\.com\/([a-z_-]+)\/([^/?#]+)/i);
  if (m) return { type: m[1].toLowerCase(), slug: m[2] };
  if (r.website_slug) return { type: 'retreat', slug: r.website_slug };
  return null;
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
}

async function wpFindPostId(type: string, slug: string): Promise<number | null> {
  const url = `${WP_BASE}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}&_fields=id`;
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ id: number }>;
  return Array.isArray(arr) && arr[0] ? arr[0].id : null;
}

async function wpWriteEventMeta(type: string, id: number, json: string): Promise<boolean> {
  const url = `${WP_BASE}/wp-json/wp/v2/${type}/${id}?_fields=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ meta: { [EVENT_META_KEY]: json } }),
  });
  return res.ok;
}

export interface SchemaSyncResult {
  total: number;
  written: number;
  skipped: { name: string; reason: string }[];
}

/** Read upcoming retreats and push Event schema to each WP page. */
export async function syncRetreatSchema(): Promise<SchemaSyncResult> {
  if (!WP_USER || !WP_PASS) throw new Error('WP credentials not configured (WP_APP_USER / WP_APP_PASSWORD)');
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('retreats')
    .select(
      'rg_id,name,excerpt,description,start_date,end_date,currency,pricing_options,status,registration_status,is_sold_out,registration_link,external_link,website_slug,feature_image_url,images,location_name'
    )
    .eq('is_public', true)
    .eq('is_active', true)
    .gte('end_date', today)
    .order('start_date', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as RetreatRow[];
  const result: SchemaSyncResult = { total: rows.length, written: 0, skipped: [] };

  for (const r of rows) {
    const schema = buildEventSchema(r);
    if (!schema) {
      result.skipped.push({ name: r.name, reason: 'missing dates' });
      continue;
    }
    const target = wpTarget(r);
    if (!target || !SUPPORTED_TYPES.has(target.type)) {
      result.skipped.push({ name: r.name, reason: `unsupported WP target: ${target?.type ?? 'none'}` });
      continue;
    }
    const id = await wpFindPostId(target.type, target.slug);
    if (!id) {
      result.skipped.push({ name: r.name, reason: `no WP ${target.type} for slug ${target.slug}` });
      continue;
    }
    const ok = await wpWriteEventMeta(target.type, id, JSON.stringify(schema));
    if (ok) result.written += 1;
    else result.skipped.push({ name: r.name, reason: 'WP write failed' });
  }
  return result;
}
