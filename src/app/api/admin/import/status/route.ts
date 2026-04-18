import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/import/status?source=retreat_guru|wetravel
 * Returns the most recent sync job for the given source.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const source = url.searchParams.get('source');
  if (!source) {
    return Response.json({ error: 'Missing source param' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: job } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('source', source)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  return Response.json({ job: job ?? null });
}
