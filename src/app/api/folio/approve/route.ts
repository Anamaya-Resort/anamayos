import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { folioApproveSchema } from '@/lib/api-schemas';
import { dbError, validationError } from '@/lib/api-utils';

/**
 * POST /api/folio/approve — guest submits signature for a line item
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.personId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = folioApproveSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  // Verify the line item belongs to a booking owned by this person (or staff)
  const { data: lineItem } = await supabase
    .from('booking_line_items')
    .select('id, booking_id, approved_at')
    .eq('id', v.line_item_id)
    .single();

  if (!lineItem) {
    return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
  }

  // Prevent re-approval
  if (lineItem.approved_at) {
    return NextResponse.json({ error: 'Already approved' }, { status: 409 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('person_id')
    .eq('id', lineItem.booking_id)
    .single();

  const isOwner = booking?.person_id === session.personId;
  const isStaff = (session.accessLevel ?? 0) >= 3;
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { error } = await supabase
    .from('booking_line_items')
    .update({
      approved_at: new Date().toISOString(),
      approved_signature: v.signature,
      approved_location_name: v.location_name ?? null,
      approved_location_coords: v.location_coords ?? null,
      approved_by_person_id: session.personId,
      approval_method: 'self',
    })
    .eq('id', v.line_item_id);

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
