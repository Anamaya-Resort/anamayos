'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared';
import type { BookingListItem } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface BookingTableProps {
  bookings: BookingListItem[];
  dict: TranslationKeys;
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
            <th className="pb-3 pr-4 font-medium">{dict.bookings.checkOut}</th>
            <th className="pb-3 pr-4 font-medium">{dict.bookings.status}</th>
            <th className="pb-3 font-medium text-right">{dict.bookings.total}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const isAnomaly = booking.total_amount === 0 && booking.status === 'confirmed';

            return (
              <tr
                key={booking.id}
                className={`border-b last:border-0 hover:bg-muted/50 ${
                  isAnomaly ? 'bg-status-warning/30' : ''
                }`}
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/dashboard/bookings/${booking.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {booking.reference_code}
                  </Link>
                  {booking.is_sub_booking && (
                    <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">
                      +1
                    </Badge>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span>{booking.guest_name ?? booking.guest_email}</span>
                  {booking.retreat_name && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {booking.retreat_name}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted-foreground text-xs">
                  {booking.room_name ?? '—'}
                </td>
                <td className="py-3 pr-4">{booking.check_in}</td>
                <td className="py-3 pr-4">{booking.check_out}</td>
                <td className="py-3 pr-4">
                  <StatusBadge
                    status={booking.status}
                    label={dict.bookings[`status_${booking.status}` as keyof typeof dict.bookings] as string}
                  />
                </td>
                <td className="py-3 text-right font-mono">
                  <span className={isAnomaly ? 'text-status-warning' : ''}>
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
