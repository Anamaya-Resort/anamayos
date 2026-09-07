import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchRGPrograms } from '@/lib/retreat-guru';

export const dynamic = 'force-dynamic';

const VALID_DATE_TYPES = ['fixed', 'package', 'hotel', 'dateless'];
const VALID_STATUSES = ['draft', 'confirmed', 'cancelled', 'completed'];

/**
 * POST /api/admin/sync/apply
 *
 * Pulls Retreat Guru changes into AO — retreats only, and only the
 * programs that actually differ. This is deliberately NOT the full
 * importer at /api/admin/import/retreat-guru (which also walks rooms,
 * lodgings, teachers, people, bookings and transactions and takes
 * minutes). This is the small, frequent one the dashboard banner runs.
 *
 * Writes are upserts keyed on rg_id, so re-running is harmless.
 *
 * AO-only fields (tagline, website_slug, and any hand-set
 * feature_image_url) are never overwritten — Retreat Guru does not know
 * about them. feature_image_url is only filled in when it is empty, so
 * a new retreat still gets a picture on the website.
 */
export async function POST() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();

  let programs;
  try {
    programs = await fetchRGPrograms();
  } catch (e) {
    return Response.json({ error: `Retreat Guru unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  const { data: rows } = await supabase
    .from('retreats')
    .select('rg_id, name, start_date, end_date, feature_image_url');
  const mine = new Map<number, { name: string | null; start_date: string | null; end_date: string | null; feature_image_url: string | null }>();
  for (const r of (rows ?? []) as Array<{ rg_id: number | null; name: string | null; start_date: string | null; end_date: string | null; feature_image_url: string | null }>) {
    if (r.rg_id != null) mine.set(r.rg_id, r);
  }

  let added = 0;
  let updated = 0;
  const failures: string[] = [];

  for (const p of programs) {
    const existing = mine.get(p.id);
    const isNew = !existing;
    const changed =
      !isNew &&
      ((p.start_date ?? null) !== existing.start_date ||
        (p.end_date ?? null) !== existing.end_date ||
        (p.name ?? '') !== (existing.name ?? ''));
    if (!isNew && !changed) continue;

    const row: Record<string, unknown> = {
      rg_id: p.id,
      name: p.name,
      description: p.content ?? null,
      excerpt: p.excerpt ?? null,
      date_type: VALID_DATE_TYPES.includes(p.date_type ?? '') ? p.date_type : 'fixed',
      start_date: p.start_date ?? null,
      end_date: p.end_date ?? null,
      package_nights: p.package_nights ?? null,
      status: VALID_STATUSES.includes(p.status ?? '') ? p.status : 'draft',
      is_public: p.public ?? true,
      registration_status: p.program_registration_status ?? 'open',
      categories: p.categories ?? [],
      pricing_type: p.pricing_type === 'tiered' ? 'tiered' : 'lodging',
      pricing_options: p.pricing_options ?? {},
      deposit_percentage: p.deposit_percentage ?? 50,
      max_capacity: p.max_capacity ?? null,
      available_spaces: p.available_spaces ?? null,
      currency: p.currency ?? 'USD',
      program_info: p.program_info ?? {},
      images: p.images ?? {},
      external_link: p.program_link ?? null,
      registration_link: p.registration_link ?? null,
    };

    // Give brand-new retreats a hero image so website cards aren't blank.
    // Never clobber one that is already set.
    if (!existing?.feature_image_url) {
      const hero = pickHero(p.images);
      if (hero) row.feature_image_url = hero;
    }

    const { error } = await supabase.from('retreats').upsert(row, { onConflict: 'rg_id' });
    if (error) failures.push(`${p.id}: ${error.message}`);
    else if (isNew) added++;
    else updated++;
  }

  return Response.json({
    ok: failures.length === 0,
    added,
    updated,
    failures,
    appliedAt: new Date().toISOString(),
  });
}

/** Largest available RG image for a program, if any. */
function pickHero(images: unknown): string | null {
  if (!images || typeof images !== 'object' || Array.isArray(images)) return null;
  const bySize = images as Record<string, { url?: string }>;
  for (const key of ['large', 'full', 'medium', 'thumbnail']) {
    const url = bySize[key]?.url;
    if (typeof url === 'string' && url) return url;
  }
  return null;
}
