import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { upsertPlanSchema } from '../_schemas';

/**
 * GET /api/planner/plan?retreatId=... — return the retreat's experience plan,
 * or { plan: null } if none exists yet (staff+).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const retreatId = new URL(request.url).searchParams.get('retreatId');
  if (!retreatId) return Response.json({ error: 'Missing retreatId' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('experience_plans')
    .select('*')
    .eq('retreat_id', retreatId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ plan: data ?? null });
}

/**
 * PUT /api/planner/plan — upsert a retreat's experience plan by retreat_id
 * (staff+; retreat leaders scoped to their own retreats, mirroring the
 * retreats API). Replaces the plan's events / status.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = upsertPlanSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Retreat leaders can only edit plans for their own retreats.
  if (session.accessLevel < 5) {
    const { data: teacher } = await supabase
      .from('retreat_teachers')
      .select('id')
      .eq('retreat_id', parsed.data.retreatId)
      .eq('person_id', session.personId)
      .maybeSingle();
    if (!teacher) {
      return Response.json({ error: 'Not authorized for this retreat' }, { status: 403 });
    }
  }

  const row: Record<string, unknown> = {
    retreat_id: parsed.data.retreatId,
    events: parsed.data.events,
  };
  if (parsed.data.name !== undefined) row.name = parsed.data.name ?? null;
  if (parsed.data.status !== undefined) row.status = parsed.data.status;
  if (parsed.data.sourceTemplateId !== undefined) row.source_template_id = parsed.data.sourceTemplateId ?? null;

  // Set created_by only on first insert (ignored on conflict update).
  const { data: existing } = await supabase
    .from('experience_plans')
    .select('id')
    .eq('retreat_id', parsed.data.retreatId)
    .maybeSingle();
  if (!existing) row.created_by = session.personId;

  const { data, error } = await supabase
    .from('experience_plans')
    .upsert(row, { onConflict: 'retreat_id' })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ plan: data });
}
