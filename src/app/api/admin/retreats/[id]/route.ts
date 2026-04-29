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
 * DELETE /api/admin/retreats/[id]?permanent=true
 * Without ?permanent: soft-delete (status → 'deleted')
 * With ?permanent=true: hard delete (admin only)
 * Retreat leaders can soft-delete their own retreats.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === 'true';
  const supabase = createServiceClient();

  // Retreat leaders can only delete their own retreats
  if (session.accessLevel < 5) {
    const { data: teacher } = await supabase
      .from('retreat_teachers')
      .select('id')
      .eq('retreat_id', id)
      .eq('person_id', session.personId)
      .maybeSingle();
    if (!teacher) return Response.json({ error: 'Not authorized for this retreat' }, { status: 403 });
  }

  if (permanent) {
    // Hard delete — admin only
    if (session.accessLevel < 5) {
      return Response.json({ error: 'Admin access required for permanent delete' }, { status: 403 });
    }
    const { error } = await supabase.from('retreats').delete().eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    // Soft delete — set status to 'deleted'
    const { error } = await supabase.from('retreats').update({ status: 'deleted', is_active: false, is_public: false }).eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
