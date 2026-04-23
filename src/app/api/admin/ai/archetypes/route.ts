import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/ai/archetypes?orgId=...
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');
  if (!orgId) return Response.json({ error: 'Missing orgId' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_customer_archetypes')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ archetypes: data ?? [] });
}

/**
 * POST /api/admin/ai/archetypes — Create new archetype
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const orgId = body.org_id as string;
  const name = body.name as string;
  if (!orgId || !name) return Response.json({ error: 'Missing org_id or name' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_customer_archetypes')
    .insert({
      org_id: orgId,
      name,
      description: body.description ?? '',
      demographics: body.demographics ?? {},
      motivations: body.motivations ?? [],
      pain_points: body.pain_points ?? [],
      content_tone: body.content_tone ?? '',
      sample_messaging: body.sample_messaging ?? [],
      sort_order: (body.sort_order as number) ?? 0,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ archetype: data });
}

/**
 * PUT /api/admin/ai/archetypes — Update existing archetype
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id as string;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.demographics !== undefined) updates.demographics = body.demographics;
  if (body.motivations !== undefined) updates.motivations = body.motivations;
  if (body.pain_points !== undefined) updates.pain_points = body.pain_points;
  if (body.content_tone !== undefined) updates.content_tone = body.content_tone;
  if (body.sample_messaging !== undefined) updates.sample_messaging = body.sample_messaging;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await supabase
    .from('ai_customer_archetypes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ archetype: data });
}

/**
 * DELETE /api/admin/ai/archetypes?id=...
 */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from('ai_customer_archetypes').delete().eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
