import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createBookingSchema = z.object({
  retreatId: z.string().uuid().optional(),
  roomId: z.string().uuid(),
  bedIds: z.array(z.string().uuid()).min(1).max(4),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numGuests: z.number().min(1).max(10),
  bookingType: z.string().max(50),
  bedArrangement: z.string().max(20).optional(),
  guestInfo: z.object({
    fullName: z.string().min(1).max(200),
    email: z.string().email(),
    phone: z.string().max(30).optional(),
  }),
  participants: z.array(z.object({
    fullName: z.string().min(1).max(200),
    email: z.string().email().optional(),
  })).optional(),
  needsApproval: z.boolean().optional(),
});

/**
 * POST /api/bookings/create
 * Creates a booking + bed assignments + participants.
 * Works for both staff (authenticated) and public guests.
 */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  const supabase = createServiceClient();

  // 1. Find or create the guest person record
  const email = data.guestInfo.email.toLowerCase().trim();
  let personId: string;

  const { data: existingPerson } = await supabase
    .from('persons').select('id').eq('email', email).single();

  if (existingPerson) {
    personId = existingPerson.id;
    // Update name/phone if provided
    await supabase.from('persons').update({
      full_name: data.guestInfo.fullName,
      ...(data.guestInfo.phone ? { phone: data.guestInfo.phone } : {}),
    }).eq('id', personId);
  } else {
    const { data: newPerson, error: personErr } = await supabase
      .from('persons')
      .insert({
        email,
        full_name: data.guestInfo.fullName,
        phone: data.guestInfo.phone ?? null,
      })
      .select('id').single();
    if (personErr || !newPerson) {
      return Response.json({ error: 'Failed to create guest record' }, { status: 500 });
    }
    personId = newPerson.id;
  }

  // 2. Verify beds are still available (prevent double-booking)
  const { data: conflicting } = await supabase
    .from('booking_bed_assignments')
    .select('bed_id, bookings!inner(check_in, check_out, status)')
    .in('bed_id', data.bedIds)
    .in('status', ['confirmed', 'pending_approval']);

  const conflictingBeds = (conflicting ?? []).filter((a: Record<string, unknown>) => {
    const booking = a.bookings as { check_in: string; check_out: string; status: string } | null;
    if (!booking || booking.status === 'cancelled' || booking.status === 'no_show') return false;
    return booking.check_in < data.checkOut && booking.check_out > data.checkIn;
  });

  if (conflictingBeds.length > 0) {
    return Response.json({ error: 'One or more beds are no longer available for these dates' }, { status: 409 });
  }

  // 3. Create the booking
  const bookingStatus = data.needsApproval ? 'inquiry' : 'confirmed';

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      person_id: personId,
      retreat_id: data.retreatId ?? null,
      room_id: data.roomId,
      status: bookingStatus,
      check_in: data.checkIn,
      check_out: data.checkOut,
      num_guests: data.numGuests,
      booking_type: data.bookingType,
      bed_arrangement: data.bedArrangement ?? null,
      total_amount: 0, // To be calculated based on pricing
      currency: 'USD',
      guest_type: 'participant',
    })
    .select('id, reference_code')
    .single();

  if (bookingErr || !booking) {
    return Response.json({ error: bookingErr?.message ?? 'Failed to create booking' }, { status: 500 });
  }

  // 4. Create bed assignments
  const assignmentStatus = data.needsApproval ? 'pending_approval' : 'confirmed';
  const session = await getSession();
  const assignmentErrors: string[] = [];

  for (const bedId of data.bedIds) {
    const { error: assignErr } = await supabase.from('booking_bed_assignments').insert({
      booking_id: booking.id,
      bed_id: bedId,
      status: assignmentStatus,
      assigned_by: session?.personId ?? null,
    });
    if (assignErr) assignmentErrors.push(`Bed ${bedId}: ${assignErr.message}`);
  }

  if (assignmentErrors.length > 0) {
    // Rollback: delete the booking if bed assignments failed
    await supabase.from('bookings').delete().eq('id', booking.id);
    return Response.json({ error: 'Failed to assign beds', details: assignmentErrors }, { status: 500 });
  }

  // 5. Create participant records
  const { error: primaryErr } = await supabase.from('booking_participants').insert({
    booking_id: booking.id,
    person_id: personId,
    full_name: data.guestInfo.fullName,
    email,
    phone: data.guestInfo.phone ?? null,
    is_primary: true,
  });
  if (primaryErr) console.error('[Booking] Participant insert failed:', primaryErr.message);

  if (data.participants) {
    for (const p of data.participants) {
      const { error: partErr } = await supabase.from('booking_participants').insert({
        booking_id: booking.id,
        full_name: p.fullName,
        email: p.email?.toLowerCase() ?? null,
        is_primary: false,
      });
      if (partErr) console.error('[Booking] Participant insert failed:', partErr.message);
    }
  }

  return Response.json({
    booking: {
      id: booking.id,
      referenceCode: booking.reference_code,
      status: bookingStatus,
      needsApproval: data.needsApproval ?? false,
    },
  }, { status: 201 });
}
