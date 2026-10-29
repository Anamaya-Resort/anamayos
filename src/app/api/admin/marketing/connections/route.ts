import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/marketing/connections
 * Saves one pixel id / account id / token for a platform.
 *
 * Secrets go to `marketing_secrets`, which no browser-facing role can
 * read; only the last four characters are kept alongside for display.
 * Non-secret identifiers go to `marketing_settings` and can be read back.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { platform_key?: string; key?: string; value?: string; secret?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const platform = (body.platform_key ?? '').trim();
  const key = (body.key ?? '').trim();
  const value = (body.value ?? '').trim();
  if (!platform || !key || !value) {
    return Response.json({ error: 'platform_key, key and value are required' }, { status: 400 });
  }

  const sb = createServiceClient();

  if (body.secret) {
    const { error } = await sb.from('marketing_secrets').upsert(
      {
        platform_key: platform,
        secret_key: key,
        secret_value: value,
        last4: value.slice(-4),
        updated_by: session.personId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'platform_key,secret_key' },
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, stored: 'secret', last4: value.slice(-4) });
  }

  const { error } = await sb.from('marketing_settings').upsert(
    {
      platform_key: platform,
      setting_key: key,
      setting_value: value,
      updated_by: session.personId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'platform_key,setting_key' },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, stored: 'setting' });
}

/** GET returns non-secret settings plus masked status for secrets. */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const sb = createServiceClient();
  const [{ data: settings }, { data: secrets }] = await Promise.all([
    sb.from('marketing_settings').select('platform_key, setting_key, setting_value, updated_at'),
    sb.from('marketing_secret_status').select('platform_key, secret_key, last4, updated_at'),
  ]);
  return Response.json({ settings: settings ?? [], secrets: secrets ?? [] });
}
