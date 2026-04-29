import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/retreat-addons?retreatId=uuid
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
    .from('retreat_addons')
    .select('*')
    .eq('retreat_id', retreatId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ addons: data ?? [] });
}

/**
 * PUT /api/admin/retreat-addons
 * Replaces all add-ons for a retreat.
 * Body: { retreat_id, addons: [{ product_id, custom_price, is_required, sort_order }] }
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

  // Delete existing
  await supabase.from('retreat_addons').delete().eq('retreat_id', retreatId);

  // Insert new
  const addons = (body.addons as Array<Record<string, unknown>>) ?? [];
  if (addons.length > 0) {
    const rows = addons.map((a, i) => ({
      retreat_id: retreatId,
      product_id: a.product_id as string,
      custom_price: a.custom_price != null ? Number(a.custom_price) : null,
      is_required: a.is_required === true,
      sort_order: (a.sort_order as number) ?? i,
      is_active: true,
    }));

    const { error } = await supabase.from('retreat_addons').insert(rows);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // Re-fetch
  const { data } = await supabase.from('retreat_addons').select('*').eq('retreat_id', retreatId).order('sort_order');
  return Response.json({ addons: data ?? [] });
}
