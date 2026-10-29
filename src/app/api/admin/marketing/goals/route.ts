import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Campaign goals. These are what 0N1X-2 compares the live figures against,
 * so a goal with only a `body` (a pasted brief) is still useful — the
 * numeric targets are all optional.
 */

const NUMERIC = ['target_spend', 'target_leads', 'target_bookings', 'target_revenue', 'target_roas'] as const;

export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('marketing_goals')
    .select('*')
    .order('is_active', { ascending: false })
    .order('period_start', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ goals: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = String(body.title ?? '').trim();
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

  const row: Record<string, unknown> = {
    title,
    platform_key: str(body.platform_key),
    retreat_id: str(body.retreat_id),
    period_start: str(body.period_start),
    period_end: str(body.period_end),
    body: str(body.body),
    is_active: body.is_active === false ? false : true,
    updated_at: new Date().toISOString(),
  };
  for (const key of NUMERIC) row[key] = num(body[key]);

  const sb = createServiceClient();
  const id = str(body.id);

  if (id) {
    const { error } = await sb.from('marketing_goals').update(row).eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, id });
  }

  const { data, error } = await sb.from('marketing_goals').insert(row).select('id').single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data?.id });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb.from('marketing_goals').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** Empty strings become null so a blank form field clears the column. */
function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
