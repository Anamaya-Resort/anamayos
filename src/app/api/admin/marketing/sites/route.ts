import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Tracked sites. Adding a subdomain usually means reusing the parent's GA4
 * property id and Search Console property and setting the two filters, which
 * is why those four fields are editable rather than derived.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 4) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const sb = createServiceClient();
  const { data, error } = await sb.from('marketing_sites').select('*').order('sort_order');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sites: data ?? [] });
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

  const domain = normalizeDomain(String(body.domain ?? ''));
  if (!domain) {
    return Response.json({ error: 'A valid domain is required, e.g. cookbook.anamaya.com' }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    domain,
    label: str(body.label) ?? domain,
    ga4_property_id: digitsOnly(body.ga4_property_id),
    ga4_hostname: str(body.ga4_hostname),
    gsc_property: str(body.gsc_property),
    gsc_page_filter: str(body.gsc_page_filter),
    is_active: body.is_active === false ? false : true,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100,
    notes: str(body.notes),
    updated_at: new Date().toISOString(),
  };

  const sb = createServiceClient();
  const id = str(body.id);

  if (id) {
    const { error } = await sb.from('marketing_sites').update(row).eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, id });
  }

  const { data, error } = await sb.from('marketing_sites').insert(row).select('id').single();
  if (error) {
    const msg = error.code === '23505' || /duplicate/i.test(error.message)
      ? 'That domain is already tracked.'
      : error.message;
    return Response.json({ error: msg }, { status: 400 });
  }
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
  // The primary site is the one everything else is compared against; removing
  // it by accident is worse than making someone demote it first.
  const { data: site } = await sb.from('marketing_sites')
    .select('is_primary').eq('id', id).maybeSingle();
  if (site?.is_primary) {
    return Response.json({ error: 'The primary site cannot be removed.' }, { status: 400 });
  }

  const { error } = await sb.from('marketing_sites').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/**
 * Accepts what someone would actually paste — a bare host, a full URL, a
 * trailing slash — and returns a bare lowercase hostname, or null.
 */
function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) return null;
  return value;
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

/** GA4 property ids are numeric; strips a pasted "properties/" prefix. */
function digitsOnly(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/\D/g, '') : '';
  return s === '' ? null : s;
}
