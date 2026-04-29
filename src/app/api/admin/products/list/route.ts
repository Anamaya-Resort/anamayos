import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/products/list
 * Returns all active products (id, name, slug, short_description, base_price, images).
 * Used by the retreat add-ons picker.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, short_description, base_price, images')
    .eq('is_active', true)
    .order('name');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ products: data ?? [] });
}
