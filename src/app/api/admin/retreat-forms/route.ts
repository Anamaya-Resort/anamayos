import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/retreat-forms?retreatId=uuid
 * Returns forms + questions for a retreat.
 */
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
    .from('retreat_forms')
    .select('*, questions:retreat_form_questions(*)')
    .eq('retreat_id', retreatId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const forms = (data ?? []).map((f: Record<string, unknown>) => ({
    ...f,
    questions: ((f.questions as Array<Record<string, unknown>>) ?? []).sort(
      (a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
    ),
  }));

  return Response.json({ forms });
}

/**
 * PUT /api/admin/retreat-forms
 * Upserts a form + all its questions. Replaces existing questions.
 * Body: { retreat_id, form_type, is_enabled, title, description, questions: [...] }
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const retreatId = body.retreat_id as string;
  const formType = body.form_type as string;
  if (!retreatId || !formType) return Response.json({ error: 'Missing retreat_id or form_type' }, { status: 400 });

  const supabase = createServiceClient();

  // Upsert the form
  const { data: form, error: formError } = await supabase
    .from('retreat_forms')
    .upsert({
      retreat_id: retreatId,
      form_type: formType,
      is_enabled: body.is_enabled === true,
      title: (body.title as string) ?? '',
      description: (body.description as string) ?? '',
    }, { onConflict: 'retreat_id,form_type' })
    .select()
    .single();

  if (formError) return Response.json({ error: formError.message }, { status: 500 });

  // Replace all questions: delete existing, insert new
  await supabase.from('retreat_form_questions').delete().eq('form_id', form.id);

  const questions = (body.questions as Array<Record<string, unknown>>) ?? [];
  if (questions.length > 0) {
    const rows = questions.map((q, i) => ({
      form_id: form.id,
      question: (q.question as string) ?? '',
      question_type: (q.question_type as string) ?? 'text',
      options: q.options ?? [],
      is_required: q.is_required === true,
      help_text: (q.help_text as string) || null,
      placeholder: (q.placeholder as string) || null,
      sort_order: i,
      is_active: q.is_active !== false,
    }));

    const { error: qError } = await supabase.from('retreat_form_questions').insert(rows);
    if (qError) return Response.json({ error: qError.message }, { status: 500 });
  }

  // Re-fetch with questions
  const { data: result } = await supabase
    .from('retreat_forms')
    .select('*, questions:retreat_form_questions(*)')
    .eq('id', form.id)
    .single();

  return Response.json({ form: result });
}
