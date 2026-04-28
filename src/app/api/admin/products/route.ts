import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * PUT /api/admin/products — Update a product
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id as string;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  const fields = ['name', 'slug', 'description', 'short_description', 'base_price', 'currency',
    'duration_minutes', 'max_participants', 'is_addon', 'requires_provider',
    'contraindications', 'preparation_notes', 'sort_order', 'is_active', 'images', 'metadata'];

  for (const key of fields) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await supabase.from('products').update(update).eq('id', id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ product: data });
}
