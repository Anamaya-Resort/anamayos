import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/folio/approve — guest submits signature for a line item
 * Body: { line_item_id, signature, location_name?, location_coords? }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.personId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.line_item_id || !body.signature) {
    return NextResponse.json({ error: 'line_item_id and signature required' }, { status: 400 });
  }

  // Limit signature size (~50KB max for initials)
  const sig = String(body.signature);
  if (sig.length > 50_000 || !sig.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Invalid signature format or size' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the line item belongs to a booking owned by this person (or staff)
  const { data: lineItem } = await supabase
    .from('booking_line_items')
    .select('id, booking_id, approved_at')
    .eq('id', body.line_item_id)
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
      approved_signature: body.signature,
      approved_location_name: body.location_name ?? null,
      approved_location_coords: body.location_coords ?? null,
      approved_by_person_id: session.personId,
      approval_method: 'self',
    })
    .eq('id', body.line_item_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
