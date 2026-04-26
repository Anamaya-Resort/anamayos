import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/retreats/[id]
 * Returns full retreat with teachers, pricing_tiers, forms+questions, media.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const [
    { data: retreat, error },
    { data: teachers },
    { data: pricingTiers },
    { data: forms },
    { data: media },
  ] = await Promise.all([
    supabase.from('retreats').select('*').eq('id', id).single(),
    supabase.from('retreat_teachers').select('*, person:persons(id, full_name, email, avatar_url)').eq('retreat_id', id).order('sort_order'),
    supabase.from('retreat_pricing_tiers').select('*').eq('retreat_id', id).order('tier_order'),
    supabase.from('retreat_forms').select('*, questions:retreat_form_questions(*)').eq('retreat_id', id),
    supabase.from('retreat_media').select('*').eq('retreat_id', id).order('sort_order'),
  ]);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!retreat) return Response.json({ error: 'Not found' }, { status: 404 });

  // Sort questions within forms by sort_order
  const formsWithSortedQuestions = (forms ?? []).map((f: Record<string, unknown>) => ({
    ...f,
    questions: ((f.questions as Array<Record<string, unknown>>) ?? []).sort(
      (a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
    ),
  }));

  return Response.json({
    retreat,
    teachers: teachers ?? [],
    pricing_tiers: pricingTiers ?? [],
    forms: formsWithSortedQuestions,
    media: media ?? [],
  });
}

/**
 * DELETE /api/admin/retreats/[id] — Admin only
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('retreats').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
