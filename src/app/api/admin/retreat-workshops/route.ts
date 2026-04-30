import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

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
    .from('retreat_workshops')
    .select('*, payout:payout_person_id(id, full_name)')
    .eq('retreat_id', retreatId)
    .order('sort_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ workshops: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const retreatId = body.retreat_id as string;
  const name = (body.name as string)?.trim();
  if (!retreatId || !name) return Response.json({ error: 'Missing retreat_id or name' }, { status: 400 });

  const supabase = createServiceClient();

  // Default payout to the retreat's primary leader
  let payoutPersonId = body.payout_person_id as string | null;
  if (!payoutPersonId) {
    const { data: leader } = await supabase
      .from('retreat_teachers')
      .select('person_id')
      .eq('retreat_id', retreatId)
      .eq('is_primary', true)
      .maybeSingle();
    payoutPersonId = (leader?.person_id as string) ?? null;
  }

  const { data, error } = await supabase.from('retreat_workshops').insert({
    retreat_id: retreatId,
    name,
    description: (body.description as string) || null,
    workshop_kind: (body.workshop_kind as string) || 'workshop',
    duration_minutes: body.duration_minutes ? Number(body.duration_minutes) : null,
    price: Number(body.price) || 0,
    currency: (body.currency as string) || 'USD',
    capacity: body.capacity ? Number(body.capacity) : null,
    anamaya_pct: Number(body.anamaya_pct) || 30,
    retreat_leader_pct: Number(body.retreat_leader_pct) || 70,
    sales_commission_pct: Number(body.sales_commission_pct) || 0,
    payout_person_id: payoutPersonId,
    sort_order: Number(body.sort_order) || 0,
  }).select('*, payout:payout_person_id(id, full_name)').single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ workshop: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id as string;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  const fields = ['name', 'description', 'workshop_kind', 'duration_minutes', 'price', 'currency',
    'capacity', 'anamaya_pct', 'retreat_leader_pct', 'sales_commission_pct',
    'payout_person_id', 'sort_order', 'is_active'];

  for (const key of fields) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await supabase.from('retreat_workshops')
    .update(update).eq('id', id)
    .select('*, payout:payout_person_id(id, full_name)').single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ workshop: data });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from('retreat_workshops').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
