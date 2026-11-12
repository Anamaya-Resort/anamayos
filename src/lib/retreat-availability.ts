/**
 * Retreat availability sync (hourly, /api/cron/retreat-availability).
 *
 * Retreat Guru knows which rooms are left for every retreat but exposes it in
 * two places, neither of which the main import copies:
 *  1. The API's per-program `program_has_capacity` flag (yes/no).
 *  2. The public booking form, which tags each room type's block with
 *     `rs-lodging-<id> rs-available-lodging` or `rs-unavailable-lodging`.
 * We store both on the retreat row so the public feed
 * (/api/public/upcoming-retreats) can show "has space" plus which rooms are
 * still open. The form is HTML, not an official feed: if RG redesigns it and
 * no lodging tags are found, we store null (unknown) rather than "sold out",
 * and the feed falls back to the yes/no flag.
 */
import { createServiceClient } from '@/lib/supabase/server';

const RG_BASE_URL = process.env.RG_API_URL ?? 'https://anamaya.secure.retreat.guru/api/v1';
const RG_TOKEN = process.env.RG_API_TOKEN ?? '';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const TIMEOUT_MS = 30_000;

export interface LodgingAvailability {
  lodging_id: number;
  name: string;
  price: number | null;
  available: boolean;
}

interface RetreatRow {
  id: string;
  rg_id: number | null;
  registration_link: string | null;
  registration_status: string | null;
  pricing_options: Record<string, { name?: string; price?: number | string }> | null;
}

async function get(url: string, ua?: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: ua ? { 'user-agent': ua } : undefined, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

/** rg_id -> program_has_capacity for every program from today on. */
async function fetchCapacityFlags(today: string): Promise<Map<number, boolean>> {
  const flags = new Map<number, boolean>();
  for (let page = 1; page <= 10; page++) {
    const url = `${RG_BASE_URL}/programs?min_date=${today}&limit=100&page=${page}&token=${encodeURIComponent(RG_TOKEN)}`;
    const res = await get(url, BROWSER_UA);
    if (!res.ok) throw new Error(`RG programs ${res.status}`);
    const batch = (await res.json()) as { id: number; program_has_capacity?: boolean }[];
    for (const p of batch) if (typeof p.program_has_capacity === 'boolean') flags.set(p.id, p.program_has_capacity);
    if (batch.length < 100) break;
  }
  return flags;
}

/** Parse the booking form: lodging id -> available. Empty map = couldn't tell. */
export function parseBookingForm(html: string): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const re = /rs-lodging-(\d+)\s+rs-(available|unavailable)-lodging/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const id = Number(m[1]);
    const ok = m[2] === 'available';
    // If the same room type shows up both ways, trust "unavailable".
    out.set(id, out.has(id) ? out.get(id)! && ok : ok);
  }
  return out;
}

function toLodgingList(form: Map<number, boolean>, pricing: RetreatRow['pricing_options']): LodgingAvailability[] {
  return [...form.entries()].map(([id, available]) => {
    const p = pricing?.[String(id)];
    const price = p?.price != null && p.price !== '' ? Number(p.price) : null;
    return { lodging_id: id, name: p?.name ?? `Room type ${id}`, price: Number.isFinite(price) ? price : null, available };
  });
}

export async function syncRetreatAvailability() {
  const supabase = createServiceClient();
  // Costa Rica date (UTC-6, no DST) so "today" matches the resort's calendar.
  const today = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('retreats')
    .select('id, rg_id, registration_link, registration_status, pricing_options')
    .gte('start_date', today)
    .eq('is_active', true)
    .eq('is_public', true);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RetreatRow[];

  const flags = await fetchCapacityFlags(today);
  const checkedAt = new Date().toISOString();
  let formsRead = 0;
  let formsUnreadable = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const hasCapacity = r.rg_id != null ? flags.get(r.rg_id) ?? null : null;
    let lodging: LodgingAvailability[] | null = null;
    const link = r.registration_link ?? '';
    if (r.registration_status === 'open' && link.includes('.retreat.guru/')) {
      try {
        const res = await get(link, BROWSER_UA);
        if (res.ok) {
          const form = parseBookingForm(await res.text());
          if (form.size > 0) {
            lodging = toLodgingList(form, r.pricing_options);
            formsRead++;
          } else formsUnreadable++;
        } else formsUnreadable++;
      } catch (e) {
        errors.push(`${r.rg_id}: ${(e as Error).message}`);
      }
    }
    const { error: upErr } = await supabase
      .from('retreats')
      .update({ rg_has_capacity: hasCapacity, lodging_availability: lodging, availability_checked_at: checkedAt })
      .eq('id', r.id);
    if (upErr) errors.push(`${r.rg_id}: ${upErr.message}`);
  }

  return { retreats: rows.length, formsRead, formsUnreadable, errors };
}
