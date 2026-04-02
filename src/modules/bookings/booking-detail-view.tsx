'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, PageHeader } from '@/components/shared';
import type { BookingDetail } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface BookingDetailViewProps {
  booking: BookingDetail;
  dict: TranslationKeys;
}

export function BookingDetailView({ booking, dict }: BookingDetailViewProps) {
  const statusLabel = dict.bookings[
    `status_${booking.status}` as keyof typeof dict.bookings
  ] as string;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${dict.bookings.details} — ${booking.reference_code}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {dict.bookings.details}
              <StatusBadge status={booking.status} label={statusLabel} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label={dict.bookings.guest} value={booking.guest_name ?? booking.guest_email} />
            <Row label={dict.bookings.checkIn} value={booking.check_in} />
            <Row label={dict.bookings.checkOut} value={booking.check_out} />
            <Row label={dict.bookings.guests} value={String(booking.num_guests)} />
            <Row
              label={dict.bookings.total}
              value={new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: booking.currency,
              }).format(booking.total_amount)}
            />
            {booking.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium">{dict.bookings.notes}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{booking.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{dict.bookings.participants}</CardTitle>
          </CardHeader>
          <CardContent>
            {booking.participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">{dict.common.noResults}</p>
            ) : (
              <ul className="space-y-3">
                {booking.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{p.full_name}</p>
                      {p.email && <p className="text-muted-foreground">{p.email}</p>}
                    </div>
                    {p.is_primary && (
                      <span className="text-xs text-primary">Primary</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
