import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/api-utils';

/**
 * GET /api/admin/rooms/[id]/layout — Load room layout
 * PUT /api/admin/rooms/[id]/layout — Save room layout (upsert)
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id: roomId } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('room_layouts')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle();

  if (error) return dbError(error);

  return NextResponse.json({
    layout: data ?? {
      room_id: roomId,
      layout_json: { shapes: [], beds: [], labels: [] },
      unit: 'meters',
    },
  });
}

export async function PUT(
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

  const { layout_json, unit } = body as { layout_json: unknown; unit?: string };
  if (!layout_json || typeof layout_json !== 'object') {
    return NextResponse.json({ error: 'layout_json is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('room_layouts')
    .upsert(
      {
        room_id: roomId,
        layout_json,
        unit: unit === 'feet' ? 'feet' : 'meters',
      },
      { onConflict: 'room_id' },
    )
    .select('id, room_id, unit, updated_at')
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ layout: data });
}
