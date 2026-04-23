import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/ai/content-prompts?orgId=...
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
    .from('ai_content_prompts')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ prompts: data ?? [] });
}

/**
 * POST /api/admin/ai/content-prompts — Create new prompt template
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
  const category = body.category as string;
  if (!orgId || !name || !category) {
    return Response.json({ error: 'Missing org_id, name, or category' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_content_prompts')
    .insert({
      org_id: orgId,
      name,
      category,
      system_prompt: body.system_prompt ?? '',
      user_prompt_template: body.user_prompt_template ?? '',
      target_archetype_id: body.target_archetype_id ?? null,
      sort_order: (body.sort_order as number) ?? 0,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ prompt: data });
}

/**
 * PUT /api/admin/ai/content-prompts — Update existing prompt template
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
  if (body.category !== undefined) updates.category = body.category;
  if (body.system_prompt !== undefined) updates.system_prompt = body.system_prompt;
  if (body.user_prompt_template !== undefined) updates.user_prompt_template = body.user_prompt_template;
  if (body.target_archetype_id !== undefined) updates.target_archetype_id = body.target_archetype_id;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  const { data, error } = await supabase
    .from('ai_content_prompts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ prompt: data });
}

/**
 * DELETE /api/admin/ai/content-prompts?id=...
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
  const { error } = await supabase.from('ai_content_prompts').delete().eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
