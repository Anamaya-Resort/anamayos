import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * PUT /api/admin/product-categories — Update a category
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
  const fields = ['name', 'slug', 'description', 'icon', 'color', 'sort_order', 'is_active'];

  for (const key of fields) {
    if (key in body) update[key] = body[key];
  }

  // Handle image_url — stored in metadata or a new column. Use the icon field for image URL.
  if ('image_url' in body) update.icon = body.image_url;

  const { data, error } = await supabase.from('product_categories').update(update).eq('id', id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ category: data });
}

/**
 * POST /api/admin/product-categories — Create a category
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name as string)?.trim();
  if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });

  const slug = (body.slug as string)?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('product_categories').insert({
    name,
    slug,
    description: (body.description as string) || null,
    icon: (body.icon as string) || null,
    sort_order: (body.sort_order as number) ?? 99,
    parent_id: (body.parent_id as string) || null,
  }).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ category: data }, { status: 201 });
}

/**
 * DELETE /api/admin/product-categories?id=uuid
 */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from('product_categories').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
