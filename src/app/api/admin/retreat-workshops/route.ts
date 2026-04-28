import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

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
    .from('retreat_workshops')
    .select('*, payout:payout_person_id(id, full_name)')
    .eq('retreat_id', retreatId)
    .order('sort_order');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ workshops: data ?? [] });
}
