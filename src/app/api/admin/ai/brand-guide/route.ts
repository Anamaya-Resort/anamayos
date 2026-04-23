import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/ai/brand-guide?orgId=...
 * Returns all brand guides for an organization.
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
    .from('ai_brand_guide')
    .select('*')
    .eq('org_id', orgId)
    .order('name');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ guides: data ?? [] });
}

/**
 * PUT /api/admin/ai/brand-guide
 * Upserts a named brand guide for an organization.
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

  const orgId = body.org_id as string;
  const name = body.name as string;
  if (!orgId || !name) return Response.json({ error: 'Missing org_id or name' }, { status: 400 });

  const supabase = createServiceClient();

  // If an id is provided, update that specific guide
  if (body.id) {
    const { data, error } = await supabase
      .from('ai_brand_guide')
      .update({
        name,
        voice_tone: body.voice_tone ?? '',
        messaging_points: body.messaging_points ?? [],
        usps: body.usps ?? [],
        personality_traits: body.personality_traits ?? [],
        dos_and_donts: body.dos_and_donts ?? { dos: [], donts: [] },
        compiled_context: body.compiled_context ?? '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ guide: data });
  }

  // Otherwise insert a new guide
  const { data, error } = await supabase
    .from('ai_brand_guide')
    .insert({
      org_id: orgId,
      name,
      voice_tone: body.voice_tone ?? '',
      messaging_points: body.messaging_points ?? [],
      usps: body.usps ?? [],
      personality_traits: body.personality_traits ?? [],
      dos_and_donts: body.dos_and_donts ?? { dos: [], donts: [] },
      compiled_context: body.compiled_context ?? '',
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ guide: data });
}

/**
 * DELETE /api/admin/ai/brand-guide?id=...
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
  const { error } = await supabase.from('ai_brand_guide').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
