import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * PUT /api/admin/ai/models
 * Updates the model registry for a provider.
 * Body: { provider: string, models: AiModel[] }
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { provider: string; models: unknown[] };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider, models } = body;
  if (!provider || !Array.isArray(models)) {
    return Response.json({ error: 'Missing provider or models array' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('ai_providers').update({
    models,
    updated_at: new Date().toISOString(),
  }).eq('id', provider);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
