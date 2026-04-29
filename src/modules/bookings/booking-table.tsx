'use client';

import Link from 'next/link';
import { decodeHtml } from '@/lib/decode-html';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared';
import type { BookingListItem, PaymentState } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface BookingTableProps {
  bookings: BookingListItem[];
  dict: TranslationKeys;
}

const PAYMENT_STYLES: Record<PaymentState, { label: string; className: string }> = {
  no_payment: { label: 'depositDue', className: 'bg-status-warning text-status-warning' },
  deposit_paid: { label: 'depositPaid', className: 'bg-status-info text-status-info' },
  partial: { label: 'partialPaid', className: 'bg-status-info text-status-info' },
  paid_in_full: { label: 'paidInFull', className: 'bg-status-success text-status-success' },
  overdue: { label: 'overdue', className: 'bg-status-destructive text-status-destructive' },
  not_applicable: { label: '', className: '' },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export function BookingTable({ bookings, dict }: BookingTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 pr-4 font-medium">{dict.bookings.reference}</th>
            <th className="pb-3 pr-4 font-medium">{dict.bookings.guest}</th>
            <th className="pb-3 pr-4 font-medium">{dict.calendar.room}</th>
            <th className="pb-3 pr-4 font-medium">{dict.bookings.checkIn}</th>
            <th className="pb-3 pr-4 font-medium">{dict.bookings.status}</th>
            <th className="pb-3 pr-4 font-medium">{dict.bookings.payment}</th>
            <th className="pb-3 font-medium text-right">{dict.bookings.total}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking, idx) => {
            const isSub = booking.is_sub_booking;

            // Compute sub-booking index within its group (+1, +2, +3, etc.)
            let subIndex = 1;
            if (isSub) {
              for (let i = idx - 1; i >= 0; i--) {
                const prev = bookings[i];
                if (!prev.is_sub_booking) break;
                if (prev.check_in === booking.check_in && prev.check_out === booking.check_out) {
                  subIndex++;
                } else {
                  break;
                }
              }
            }

            // Determine if next row is in the same group (faint divider)
            const nextBooking = bookings[idx + 1];
            const nextIsSub = nextBooking?.is_sub_booking;
            const sameGroup = nextIsSub &&
              nextBooking.check_in === booking.check_in &&
              nextBooking.check_out === booking.check_out;
            const thisAndNextSameGroup = isSub && nextIsSub &&
              nextBooking.check_in === booking.check_in;
            const faintBorder = sameGroup || thisAndNextSameGroup;

            // Payment display
            const ps = PAYMENT_STYLES[booking.payment_state];
            const paymentLabel = ps.label
              ? (dict.bookings[ps.label as keyof typeof dict.bookings] as string) ?? ps.label
              : '';

            return (
              <tr
                key={booking.id}
                className={`hover:bg-muted/50 cursor-pointer ${
                  faintBorder ? 'border-b border-border/50' : 'border-b'
                } ${isSub ? 'bg-muted/20' : ''}`}
                onClick={() => window.location.href = `/dashboard/bookings/${booking.id}`}
              >
                <td className="py-3 pr-4">
                  <div className={isSub ? 'pl-4' : ''}>
                    <Link
                      href={`/dashboard/bookings/${booking.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {booking.reference_code}
                    </Link>
                    {isSub && (
                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 text-muted-foreground">
                        +{subIndex}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className={isSub ? 'text-muted-foreground' : ''}>
                    {booking.guest_name ?? booking.guest_email}
                  </span>
                  {booking.retreat_name && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {decodeHtml(booking.retreat_name)}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted-foreground text-xs">
                  {booking.room_name ?? '—'}
                </td>
                <td className="py-3 pr-4">
                  {fmtDate(booking.check_in)}
                  <span className="text-muted-foreground"> — </span>
                  {fmtDate(booking.check_out)}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge
                    status={booking.status}
                    label={dict.bookings[`status_${booking.status}` as keyof typeof dict.bookings] as string}
                  />
                </td>
                <td className="py-3 pr-4">
                  {booking.payment_state !== 'not_applicable' && paymentLabel && (
                    <div>
                      <Badge variant="outline" className={`text-[10px] ${ps.className}`}>
                        {paymentLabel}
                      </Badge>
                      {booking.balance_due > 0 && booking.total_amount > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          ${booking.amount_paid.toFixed(0)} / ${booking.total_amount.toFixed(0)}
                        </p>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-3 text-right font-mono">
                  <span className={booking.payment_state === 'overdue' ? 'text-status-destructive' : ''}>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: booking.currency,
                    }).format(booking.total_amount)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
