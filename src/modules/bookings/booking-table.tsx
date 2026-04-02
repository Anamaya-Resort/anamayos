'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/shared';
import type { BookingListItem } from './types';
import type { TranslationKeys } from '@/i18n/en';
import type { BookingStatus } from '@/types';

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
            <th className="pb-3 pr-4 font-medium">{dict.bookings.checkIn}</th>
            <th className="pb-3 pr-4 font-medium">{dict.bookings.checkOut}</th>
            <th className="pb-3 pr-4 font-medium">{dict.bookings.status}</th>
            <th className="pb-3 font-medium text-right">{dict.bookings.total}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-3 pr-4">
                <Link
                  href={`/dashboard/bookings/${booking.id}`}
                  className="font-mono text-primary hover:underline"
                >
                  {booking.reference_code}
                </Link>
              </td>
              <td className="py-3 pr-4">
                {booking.guest_name ?? booking.guest_email}
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
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: booking.currency,
                }).format(booking.total_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
