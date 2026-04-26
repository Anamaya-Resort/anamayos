import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/persons/search?q=query
 * Searches persons by name or email. Returns up to 20 results.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('persons')
    .select('id, full_name, email')
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .eq('is_active', true)
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ results: data ?? [] });
}
