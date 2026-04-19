'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge, PageHeader } from '@/components/shared';
import { BookingForm } from './booking-form';
import { ChargeEntryModal } from './charge-entry-modal';
import { LineItemsCard } from './line-items-card';
import type { BookingDetail } from './types';
import type { TranslationKeys } from '@/i18n/en';
import { Pencil, Plus } from 'lucide-react';

interface BookingDetailViewProps {
  booking: BookingDetail;
  rooms: Array<{ id: string; name: string }>;
  dict: TranslationKeys;
}

export function BookingDetailView({ booking, rooms, dict }: BookingDetailViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [lineItemRefresh, setLineItemRefresh] = useState(0);

  const statusLabel = dict.bookings[
    `status_${booking.status}` as keyof typeof dict.bookings
  ] as string;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${dict.bookings.details} — ${booking.reference_code}`}
        actions={
          <div className="flex gap-2">
            <Button variant="default" onClick={() => setChargeOpen(true)} className="ao-btn-fx--success">
              <Plus className="mr-2 h-4 w-4" />
              {dict.folio.addCharge}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {dict.common.edit}
            </Button>
          </div>
        }
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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{dict.bookings.guest}</span>
              <span className="font-bold" style={{ fontSize: '1rem' }}>{booking.guest_name ?? booking.guest_email}</span>
            </div>
            <Row label={dict.bookings.checkIn} value={fmtDate(booking.check_in)} />
            <Row label={dict.bookings.checkOut} value={fmtDate(booking.check_out)} />
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
            <ul className="space-y-3">
              {/* Always show the primary guest from booking data */}
              {booking.participants.length === 0 && (
                <li className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{booking.guest_name ?? 'Unknown'}</p>
                    {booking.guest_email && <p className="text-muted-foreground">{booking.guest_email}</p>}
                  </div>
                  <span className="text-xs text-primary">{dict.bookings.primaryGuest}</span>
                </li>
              )}
              {booking.participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{p.full_name}</p>
                    {p.email && <p className="text-muted-foreground">{p.email}</p>}
                  </div>
                  {p.is_primary && (
                    <span className="text-xs text-primary">{dict.bookings.primaryGuest}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Status workflow buttons */}
      <StatusWorkflow booking={booking} dict={dict} onChanged={() => router.refresh()} />

      {/* Folio — line items */}
      <LineItemsCard bookingId={booking.id} dict={dict} refreshKey={lineItemRefresh} />

      <ChargeEntryModal
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        booking={booking}
        dict={dict}
        onCreated={() => {
          setLineItemRefresh((n) => n + 1);
          router.refresh();
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.common.edit} — {booking.reference_code}</DialogTitle>
          </DialogHeader>
          <BookingForm
            booking={booking}
            rooms={rooms}
            dict={dict}
            onSaved={() => { setEditOpen(false); router.refresh(); }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Quick status change buttons based on current status */
function StatusWorkflow({
  booking,
  dict,
  onChanged,
}: {
  booking: BookingDetail;
  dict: TranslationKeys;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);

  // Define valid next statuses
  const transitions: Record<string, string[]> = {
    inquiry: ['quote_sent', 'confirmed', 'cancelled'],
    quote_sent: ['confirmed', 'cancelled'],
    confirmed: ['deposit_paid', 'paid_in_full', 'cancelled'],
    deposit_paid: ['paid_in_full', 'cancelled'],
    paid_in_full: ['checked_in', 'cancelled'],
    checked_in: ['checked_out'],
    checked_out: [],
    cancelled: ['inquiry'],
    no_show: [],
  };

  const nextStatuses = transitions[booking.status] ?? [];
  if (nextStatuses.length === 0) return null;

  async function changeStatus(newStatus: string) {
    setLoading(true);
    try {
      await fetch('/api/admin/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, status: newStatus }),
      });
      onChanged();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-2 pt-6">
        <span className="text-sm text-muted-foreground mr-2 self-center">
          {dict.bookings.status}:
        </span>
        {nextStatuses.map((s) => (
          <Button
            key={s}
            variant={s === 'cancelled' ? 'outline' : 'default'}
            size="sm"
            disabled={loading}
            onClick={() => changeStatus(s)}
            className={s === 'cancelled' ? 'text-destructive ao-btn-fx--danger' : 'ao-btn-fx--success'}
          >
            {dict.bookings[`status_${s}` as keyof typeof dict.bookings] as string ?? s}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
