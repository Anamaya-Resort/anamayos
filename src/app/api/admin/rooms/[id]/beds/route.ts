import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/api-utils';

/**
 * POST /api/admin/rooms/[id]/beds — Add a bed to a room
 * DELETE /api/admin/rooms/[id]/beds?bedId=xxx — Remove a bed
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id: roomId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { label, bed_type, capacity, width_m, length_m } = body as Record<string, unknown>;
  if (!label || typeof label !== 'string') {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get next sort_order
  const { data: existing } = await supabase
    .from('beds')
    .select('sort_order')
    .eq('room_id', roomId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSort = ((existing?.[0] as Record<string, unknown>)?.sort_order as number ?? 0) + 1;

  const { data, error } = await supabase
    .from('beds')
    .insert({
      room_id: roomId,
      label,
      bed_type: bed_type ?? 'single',
      capacity: capacity ?? 1,
      width_m: width_m ?? 1.0,
      length_m: length_m ?? 1.9,
      sort_order: nextSort,
    })
    .select('id, label, bed_type, capacity, width_m, length_m')
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ bed: data });
}

/**
 * PUT /api/admin/rooms/[id]/beds — Update a bed's label and/or type
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await params; // consume params

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { bedId, label, bed_type } = body as Record<string, unknown>;
  if (!bedId || typeof bedId !== 'string') {
    return NextResponse.json({ error: 'bedId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};
  if (label !== undefined) update.label = label;
  if (bed_type !== undefined) update.bed_type = bed_type;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabase.from('beds').update(update).eq('id', bedId);
  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const bedId = url.searchParams.get('bedId');
  if (!bedId) {
    return NextResponse.json({ error: 'bedId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('beds')
    .delete()
    .eq('id', bedId);

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
