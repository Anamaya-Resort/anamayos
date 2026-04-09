import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/bookings — Create a new booking
 * PUT /api/admin/bookings — Update an existing booking
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.person_id || !body.check_in || !body.check_out) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      person_id: body.person_id,
      retreat_id: body.retreat_id || null,
      room_id: body.room_id || null,
      status: body.status || 'inquiry',
      check_in: body.check_in,
      check_out: body.check_out,
      num_guests: body.num_guests || 1,
      total_amount: body.total_amount || 0,
      currency: body.currency || 'USD',
      guest_type: body.guest_type || 'participant',
      notes: body.notes || null,
    })
    .select('id, reference_code')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data.id, reference_code: data.reference_code });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.room_id !== undefined) update.room_id = body.room_id || null;
  if (body.retreat_id !== undefined) update.retreat_id = body.retreat_id || null;
  if (body.check_in !== undefined) update.check_in = body.check_in;
  if (body.check_out !== undefined) update.check_out = body.check_out;
  if (body.num_guests !== undefined) update.num_guests = body.num_guests;
  if (body.total_amount !== undefined) update.total_amount = body.total_amount;
  if (body.currency !== undefined) update.currency = body.currency;
  if (body.notes !== undefined) update.notes = body.notes || null;

  const { error } = await supabase
    .from('bookings')
    .update(update)
    .eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
