import { createServiceClient } from '@/lib/supabase/server';
import type { BookingListItem, PaymentState } from './types';

interface GetBookingsOptions {
  limit?: number;
  orderBy?: 'check_in' | 'created_at';
}

export async function getBookings(options: GetBookingsOptions = {}): Promise<BookingListItem[]> {
  const { limit = 2000, orderBy = 'check_in' } = options;

  try {
    const supabase = createServiceClient();
    let query = supabase
      .from('bookings')
      .select('*, persons(full_name, email), rooms(name), retreats(name)')
      .order(orderBy, { ascending: false });

    // Add secondary sort for stable ordering when primary values are identical
    if (orderBy === 'created_at') {
      query = query.order('check_in', { ascending: false });
    }

    const { data, error } = await query.limit(limit);

    if (error || !data) return [];

    // Fetch payment totals per booking from transactions
    const { data: txData } = await supabase
      .from('transactions')
      .select('booking_id, credit_amount')
      .not('booking_id', 'is', null);

    const paymentsByBooking = new Map<string, number>();
    for (const tx of (txData ?? []) as Array<{ booking_id: string; credit_amount: number }>) {
      const current = paymentsByBooking.get(tx.booking_id) ?? 0;
      paymentsByBooking.set(tx.booking_id, current + (tx.credit_amount ?? 0));
    }

    const today = new Date().toISOString().split('T')[0];

    // Detect sub-bookings: explicit rg_parent_booking_id, or implicit (same person + dates + $0 amount)
    const personDateKey = (personId: string, checkIn: string, checkOut: string) =>
      `${personId}|${checkIn}|${checkOut}`;
    const personDateBookings = new Map<string, Array<{ id: string; amount: number; rgParent: number }>>();

    for (const row of data) {
      const r = row as Record<string, unknown>;
      const key = personDateKey(r.person_id as string, r.check_in as string, r.check_out as string);
      if (!personDateBookings.has(key)) personDateBookings.set(key, []);
      personDateBookings.get(key)!.push({
        id: r.id as string,
        amount: (r.total_amount as number) ?? 0,
        rgParent: (r.rg_parent_booking_id as number) ?? 0,
      });
    }

    const mapped = data.map((row: Record<string, unknown>) => {
      const person = row.persons as { full_name: string | null; email: string } | null;
      const room = row.rooms as { name: string } | null;
      const retreat = row.retreats as { name: string } | null;
      const bookingId = row.id as string;
      const totalAmount = (row.total_amount as number) ?? 0;
      const amountPaid = paymentsByBooking.get(bookingId) ?? 0;
      const balanceDue = Math.max(0, totalAmount - amountPaid);
      const rgParent = (row.rg_parent_booking_id as number) ?? 0;
      const status = row.status as string;
      const checkIn = row.check_in as string;

      // Detect sub-booking: explicit rg_parent_booking_id, OR same person+dates with $0 where a paid sibling exists
      let isSub = rgParent > 0;
      if (!isSub && totalAmount === 0) {
        const key = personDateKey(row.person_id as string, checkIn, row.check_out as string);
        const siblings = personDateBookings.get(key) ?? [];
        if (siblings.length > 1 && siblings.some((s) => s.id !== bookingId && s.amount > 0)) {
          isSub = true;
        }
      }

      // Determine payment state
      let paymentState: PaymentState;
      if (isSub && totalAmount === 0) {
        paymentState = 'not_applicable';
      } else if (status === 'cancelled' || status === 'no_show') {
        paymentState = 'not_applicable';
      } else if (totalAmount === 0 && amountPaid === 0) {
        paymentState = 'no_payment';
      } else if (amountPaid >= totalAmount && totalAmount > 0) {
        paymentState = 'paid_in_full';
      } else if (amountPaid > 0 && amountPaid < totalAmount * 0.5) {
        paymentState = 'deposit_paid';
      } else if (amountPaid > 0) {
        paymentState = 'partial';
      } else if (checkIn <= today && amountPaid === 0 && totalAmount > 0) {
        paymentState = 'overdue';
      } else {
        paymentState = 'no_payment';
      }

      return {
        ...(row as unknown as BookingListItem),
        guest_name: person?.full_name ?? null,
        guest_email: person?.email ?? '',
        room_name: room?.name ?? null,
        retreat_name: retreat?.name ?? null,
        is_sub_booking: isSub,
        guest_type: (row.guest_type as string) ?? 'participant',
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_state: paymentState,
        _rg_id: (row.rg_id as number) ?? null,
        _rg_parent_id: (row.rg_parent_booking_id as number) ?? null,
      };
    });

    // Group sub-bookings under their parent
    const result: BookingListItem[] = [];
    const subs = mapped.filter((b) => (b as Record<string, unknown>)._rg_parent_id);
    const parents = mapped.filter((b) => !(b as Record<string, unknown>)._rg_parent_id);

    for (const b of parents) {
      result.push(b);
      const bRgId = (b as Record<string, unknown>)._rg_id as number | null;
      if (bRgId) {
        const children = subs.filter((s) => (s as Record<string, unknown>)._rg_parent_id === bRgId);
        result.push(...children);
        for (const c of children) {
          const idx = subs.indexOf(c);
          if (idx >= 0) subs.splice(idx, 1);
        }
      }
    }
    result.push(...subs);

    return result;
  } catch {
    return [];
  }
}
