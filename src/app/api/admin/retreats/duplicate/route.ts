import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/retreats/duplicate
 * Duplicates a retreat: copies content, teachers, pricing tiers, form templates.
 * Clears dates, sets status=draft, approval_status=pending.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sourceId = body.retreat_id as string;
  if (!sourceId) return Response.json({ error: 'Missing retreat_id' }, { status: 400 });

  const supabase = createServiceClient();

  // Fetch source retreat
  const { data: source, error } = await supabase.from('retreats').select('*').eq('id', sourceId).single();
  if (error || !source) return Response.json({ error: 'Retreat not found' }, { status: 404 });

  // Create the copy
  const copy = { ...source } as Record<string, unknown>;
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  copy.name = (source.name as string) + ' (Copy)';
  copy.start_date = null;
  copy.end_date = null;
  copy.status = 'draft';
  copy.is_public = false;
  copy.is_featured = false;
  copy.is_sold_out = false;
  copy.approval_status = 'pending';
  copy.approved_by = null;
  copy.approved_at = null;
  copy.approval_notes = null;
  copy.available_spaces = copy.max_capacity;
  copy.website_slug = null;
  copy.rg_id = null;

  const { data: newRetreat, error: createErr } = await supabase
    .from('retreats').insert(copy).select().single();
  if (createErr) return Response.json({ error: createErr.message }, { status: 500 });

  const newId = newRetreat.id as string;

  // Copy teachers
  const { data: teachers } = await supabase.from('retreat_teachers').select('*').eq('retreat_id', sourceId);
  if (teachers && teachers.length > 0) {
    await supabase.from('retreat_teachers').insert(
      teachers.map((t: Record<string, unknown>) => ({
        retreat_id: newId, person_id: t.person_id, role: t.role,
        is_primary: t.is_primary, bio_override: t.bio_override, sort_order: t.sort_order,
      }))
    );
  }

  // Copy pricing tiers
  const { data: tiers } = await supabase.from('retreat_pricing_tiers').select('*').eq('retreat_id', sourceId);
  if (tiers && tiers.length > 0) {
    await supabase.from('retreat_pricing_tiers').insert(
      tiers.map((t: Record<string, unknown>) => ({
        retreat_id: newId, name: t.name, tier_order: t.tier_order, price: t.price,
        currency: t.currency, cutoff_date: null, spaces_total: t.spaces_total,
        spaces_sold: 0, description: t.description, is_active: t.is_active,
      }))
    );
  }

  // Copy forms + questions
  const { data: forms } = await supabase.from('retreat_forms').select('*, questions:retreat_form_questions(*)').eq('retreat_id', sourceId);
  if (forms) {
    for (const form of forms as Array<Record<string, unknown>>) {
      const { data: newForm } = await supabase.from('retreat_forms').insert({
        retreat_id: newId, form_type: form.form_type, is_enabled: form.is_enabled,
        title: form.title, description: form.description, created_from_template: form.created_from_template,
      }).select().single();

      if (newForm) {
        const questions = (form.questions as Array<Record<string, unknown>>) ?? [];
        if (questions.length > 0) {
          await supabase.from('retreat_form_questions').insert(
            questions.map((q) => ({
              form_id: newForm.id, question: q.question, question_type: q.question_type,
              options: q.options, is_required: q.is_required, help_text: q.help_text,
              placeholder: q.placeholder, sort_order: q.sort_order, is_active: q.is_active,
            }))
          );
        }
      }
    }
  }

  return Response.json({ retreat: newRetreat }, { status: 201 });
}
