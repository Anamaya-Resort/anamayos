import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/planner/retreats — retreats for the planner picker (staff+).
 * Returns id, name, start_date, end_date, status. Excludes deleted retreats.
 * Ordered upcoming-first (retreats whose end_date is today or later, soonest
 * start first), then past retreats (most recent first). Dateless retreats are
 * treated as upcoming and sorted last within that group.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('retreats')
    .select('id, name, start_date, end_date, status')
    .neq('status', 'deleted')
    .order('start_date', { ascending: true, nullsFirst: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const rows = data ?? [];

  const isPast = (r: { end_date: string | null }) =>
    r.end_date != null && r.end_date < today;

  const upcoming = rows
    .filter((r) => !isPast(r))
    .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'));
  const past = rows
    .filter((r) => isPast(r))
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));

  return Response.json({ retreats: [...upcoming, ...past] });
}
