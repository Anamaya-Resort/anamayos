import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/retreat-pricing?retreatId=uuid
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const retreatId = searchParams.get('retreatId');
  if (!retreatId) return Response.json({ error: 'Missing retreatId' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('retreat_pricing_tiers')
    .select('*')
    .eq('retreat_id', retreatId)
    .order('tier_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tiers: data ?? [] });
}

/**
 * PUT /api/admin/retreat-pricing
 * Replaces all pricing tiers for a retreat.
 * Body: { retreat_id, tiers: [...] }
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const retreatId = body.retreat_id as string;
  if (!retreatId) return Response.json({ error: 'Missing retreat_id' }, { status: 400 });

  const supabase = createServiceClient();

  // Delete existing tiers
  await supabase.from('retreat_pricing_tiers').delete().eq('retreat_id', retreatId);

  // Insert new tiers
  const tiers = (body.tiers as Array<Record<string, unknown>>) ?? [];
  if (tiers.length > 0) {
    const rows = tiers.map((t, i) => ({
      retreat_id: retreatId,
      name: (t.name as string) ?? `Tier ${i + 1}`,
      tier_order: i,
      price: Number(t.price) || 0,
      currency: (t.currency as string) ?? 'USD',
      cutoff_date: (t.cutoff_date as string) || null,
      spaces_total: t.spaces_total != null ? Number(t.spaces_total) : null,
      spaces_sold: Number(t.spaces_sold) || 0,
      description: (t.description as string) || null,
      is_active: t.is_active !== false,
    }));

    const { error } = await supabase.from('retreat_pricing_tiers').insert(rows);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // Re-fetch
  const { data } = await supabase
    .from('retreat_pricing_tiers')
    .select('*')
    .eq('retreat_id', retreatId)
    .order('tier_order');

  return Response.json({ tiers: data ?? [] });
}
