import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { DEFAULT_RESORT_CONFIG, type ResortConfig } from '@/modules/room-builder/types';

/**
 * GET /api/admin/resort-config
 * Returns the global resort config (shared across all room layouts).
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase.from('resort_config').select('config').eq('id', 'default').single();
  const config = data?.config ? { ...DEFAULT_RESORT_CONFIG, ...(data.config as Partial<ResortConfig>) } : DEFAULT_RESORT_CONFIG;

  return Response.json({ config });
}

/**
 * PUT /api/admin/resort-config
 * Saves the global resort config.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('resort_config').upsert(
    { id: 'default', config: body, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
