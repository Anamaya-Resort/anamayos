import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { createBookingSchema, updateBookingSchema } from '@/lib/api-schemas';
import { dbError, validationError } from '@/lib/api-utils';

/**
 * POST /api/admin/bookings — Create a new booking
 * PUT /api/admin/bookings — Update an existing booking
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      person_id: v.person_id,
      retreat_id: v.retreat_id || null,
      room_id: v.room_id || null,
      status: v.status,
      check_in: v.check_in,
      check_out: v.check_out,
      num_guests: v.num_guests,
      total_amount: v.total_amount,
      currency: v.currency,
      guest_type: v.guest_type,
      notes: v.notes || null,
    })
    .select('id, reference_code')
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ success: true, id: data.id, reference_code: data.reference_code });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateBookingSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};
  if (v.status !== undefined) update.status = v.status;
  if (v.room_id !== undefined) update.room_id = v.room_id || null;
  if (v.retreat_id !== undefined) update.retreat_id = v.retreat_id || null;
  if (v.check_in !== undefined) update.check_in = v.check_in;
  if (v.check_out !== undefined) update.check_out = v.check_out;
  if (v.num_guests !== undefined) update.num_guests = v.num_guests;
  if (v.total_amount !== undefined) update.total_amount = v.total_amount;
  if (v.currency !== undefined) update.currency = v.currency;
  if (v.guest_type !== undefined) update.guest_type = v.guest_type;
  if (v.notes !== undefined) update.notes = v.notes || null;

  const { error } = await supabase
    .from('bookings')
    .update(update)
    .eq('id', v.id);

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
