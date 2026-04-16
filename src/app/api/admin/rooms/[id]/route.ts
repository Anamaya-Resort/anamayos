import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/api-utils';

/**
 * GET /api/admin/rooms/[id] — Fetch a single room with full details
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, slug, description, max_occupancy, is_shared, base_rate_per_night, currency, room_group, amenities, category_id, sort_order, room_categories(name)')
    .eq('id', id)
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ room: data });
}

/**
 * PUT /api/admin/rooms/[id] — Update room info
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};
  if (b.name !== undefined) update.name = b.name;
  if (b.description !== undefined) update.description = b.description;
  if (b.max_occupancy !== undefined) update.max_occupancy = b.max_occupancy;
  if (b.is_shared !== undefined) update.is_shared = b.is_shared;
  if (b.base_rate_per_night !== undefined) update.base_rate_per_night = b.base_rate_per_night;
  if (b.currency !== undefined) update.currency = b.currency;
  if (b.room_group !== undefined) update.room_group = b.room_group;
  if (b.amenities !== undefined) update.amenities = b.amenities;
  if (b.category_id !== undefined) update.category_id = b.category_id;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabase.from('rooms').update(update).eq('id', id);
  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
