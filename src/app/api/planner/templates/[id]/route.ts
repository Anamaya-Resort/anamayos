import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { updateTemplateSchema } from '../../_schemas';

/**
 * PATCH /api/planner/templates/[id] — save a template's name / description /
 * events (staff+). Only fields present in the body are updated.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.description !== undefined) update.description = parsed.data.description ?? null;
  if (parsed.data.events !== undefined) update.events = parsed.data.events;

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('planner_templates')
    .update(update)
    .eq('id', id)
    .select('id, name, description, events, is_standard, created_at, updated_at')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ template: data });
}
