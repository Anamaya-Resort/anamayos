import { BookingsListView } from '@/modules/bookings';
import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { BookingListItem, PaymentState } from '@/modules/bookings';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Bookings — AO Platform' };

async function getBookings(): Promise<BookingListItem[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('*, persons(full_name, email), rooms(name), retreats(name)')
      .order('check_in', { ascending: false })
      .limit(2000);

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

    const mapped = data.map((row: Record<string, unknown>) => {
      const person = row.persons as { full_name: string | null; email: string } | null;
      const room = row.rooms as { name: string } | null;
      const retreat = row.retreats as { name: string } | null;
      const bookingId = row.id as string;
      const totalAmount = (row.total_amount as number) ?? 0;
      const amountPaid = paymentsByBooking.get(bookingId) ?? 0;
      const balanceDue = Math.max(0, totalAmount - amountPaid);
      const isSub = !!(row.rg_parent_booking_id as number);
      const status = row.status as string;
      const checkIn = row.check_in as string;

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

async function getRooms(): Promise<Array<{ id: string; name: string }>> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order');
    return (data ?? []) as Array<{ id: string; name: string }>;
  } catch {
    return [];
  }
}

export default async function BookingsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const [bookings, rooms] = await Promise.all([getBookings(), getRooms()]);

  return <BookingsListView initialBookings={bookings} rooms={rooms} dict={dict} />;
}
