import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { createTemplateSchema } from '../_schemas';

/**
 * GET /api/planner/templates — list all planner templates (staff+).
 * Standard template(s) first, then most-recently-updated.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('planner_templates')
    .select('id, name, description, events, is_standard, created_at, updated_at')
    .order('is_standard', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ templates: data ?? [] });
}

/**
 * POST /api/planner/templates — create a template from a name + events (staff+).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('planner_templates')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      events: parsed.data.events,
      is_standard: false,
      created_by: session.personId,
    })
    .select('id, name, description, events, is_standard, created_at, updated_at')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ template: data }, { status: 201 });
}
