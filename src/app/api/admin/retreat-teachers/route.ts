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
    .from('retreat_teachers')
    .select('*, person:persons(id, full_name, email, avatar_url)')
    .eq('retreat_id', retreatId)
    .order('sort_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ teachers: data ?? [] });
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
  const personId = body.person_id as string;
  if (!retreatId || !personId) return Response.json({ error: 'Missing retreat_id or person_id' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('retreat_teachers')
    .insert({
      retreat_id: retreatId,
      person_id: personId,
      role: (body.role as string) ?? 'co_teacher',
      is_primary: body.is_primary === true,
      bio_override: (body.bio_override as string) || null,
      sort_order: (body.sort_order as number) ?? 0,
    })
    .select('*, person:persons(id, full_name, email, avatar_url)')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ teacher: data });
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
  if ('role' in body) update.role = body.role;
  if ('bio_override' in body) update.bio_override = body.bio_override || null;
  if ('sort_order' in body) update.sort_order = body.sort_order;

  const { data, error } = await supabase
    .from('retreat_teachers')
    .update(update)
    .eq('id', id)
    .select('*, person:persons(id, full_name, email, avatar_url)')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ teacher: data });
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
  const { error } = await supabase.from('retreat_teachers').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
