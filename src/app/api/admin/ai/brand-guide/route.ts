import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/ai/brand-guide?orgId=...
 * Returns the brand guide for an organization.
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
  const { data } = await supabase
    .from('ai_brand_guide')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  return Response.json({ guide: data });
}

/**
 * PUT /api/admin/ai/brand-guide
 * Upserts the brand guide for an organization.
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
  if (!orgId) return Response.json({ error: 'Missing org_id' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_brand_guide')
    .upsert({
      org_id: orgId,
      voice_tone: body.voice_tone ?? '',
      messaging_points: body.messaging_points ?? [],
      usps: body.usps ?? [],
      personality_traits: body.personality_traits ?? [],
      dos_and_donts: body.dos_and_donts ?? { dos: [], donts: [] },
      compiled_context: body.compiled_context ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ guide: data });
}
