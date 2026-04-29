'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge, PageHeader } from '@/components/shared';
import { RetreatCard } from '@/components/shared/retreat-card';
import { decodeHtml } from '@/lib/decode-html';
import { BookingForm } from './booking-form';
import { ChargeEntryModal } from './charge-entry-modal';
import { LineItemsCard } from './line-items-card';
import { LayoutViewer } from '@/modules/room-builder';
import type { LayoutJson, LayoutUnit } from '@/modules/room-builder';
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

      {/* ══════ ROW 1: Guest (with participants) + Retreat Card ══════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Guest
              <StatusBadge status={booking.status} label={statusLabel} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-bold" style={{ fontSize: '1rem' }}>{booking.guest_name ?? 'Unknown'}</p>
              {booking.guest_email && <p className="text-sm text-muted-foreground">{booking.guest_email}</p>}
            </div>
            {booking.guest_phone && <Row label="Phone" value={booking.guest_phone} />}
            {booking.guest_whatsapp && <Row label="WhatsApp" value={booking.guest_whatsapp} />}
            {booking.guest_gender && <Row label="Gender" value={booking.guest_gender} />}
            {booking.guest_dob && <Row label="Date of Birth" value={fmtDate(booking.guest_dob)} />}
            {booking.guest_city && <Row label="City" value={booking.guest_city} />}
            {booking.guest_country && <Row label="Country" value={booking.guest_country} />}
            {booking.guest_nationality && <Row label="Nationality" value={booking.guest_nationality} />}

            {/* Participants — below guest details */}
            {booking.participants.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">{dict.bookings.participants}</p>
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between text-sm">
                      <p className="font-medium">{booking.guest_name ?? 'Unknown'}</p>
                      <span className="text-xs text-primary">{dict.bookings.primaryGuest}</span>
                    </li>
                    {booking.participants
                      .filter((p) => !p.is_primary)
                      .map((p, i) => (
                        <li key={p.id} className="flex items-center justify-between text-sm">
                          <p className="font-medium">{p.full_name}</p>
                          <span className="text-xs text-muted-foreground">+{i + 1}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Retreat Card */}
        {booking.retreat_data ? (
          <RetreatCard retreat={booking.retreat_data} variant="default" statusBorder />
        ) : booking.retreat_name ? (
          <Card>
            <CardHeader><CardTitle>Retreat</CardTitle></CardHeader>
            <CardContent>
              <p className="font-semibold">{decodeHtml(booking.retreat_name!)}</p>
              {booking.retreat_teacher && <p className="text-sm text-muted-foreground">with {booking.retreat_teacher}</p>}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* ══════ ROW 2: Retreat Booking + Room + Room Layout ══════ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Retreat & Payment */}
        <Card>
          <CardHeader>
            <CardTitle>Retreat Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {booking.retreat_name ? (
              <div>
                <p className="font-semibold">{decodeHtml(booking.retreat_name!)}</p>
                {booking.retreat_teacher && <p className="text-sm text-muted-foreground">Teacher: {booking.retreat_teacher}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No retreat assigned</p>
            )}
            <Separator />
            <Row label={dict.bookings.checkIn} value={fmtDate(booking.check_in)} />
            <Row label={dict.bookings.checkOut} value={fmtDate(booking.check_out)} />
            <Row label={dict.bookings.guests} value={String(booking.num_guests)} />
            <Separator />
            <Row
              label={dict.bookings.total}
              value={fmtCurrency(booking.total_amount, booking.currency)}
            />
            {/* Payment summary from transactions */}
            {(() => {
              const txs = booking.transactions ?? [];
              const totalPaid = txs.filter((t) => t.class === 'card_payment' || t.class === 'non_cc_payment').reduce((s, t) => s + t.credit_amount, 0);
              const balance = booking.total_amount - totalPaid;
              const deposits = txs.filter((t) => t.credit_amount > 0 && t.trans_date);
              return (
                <>
                  {totalPaid > 0 && <Row label="Paid" value={fmtCurrency(totalPaid, booking.currency)} />}
                  {balance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-status-destructive font-medium">Balance Due</span>
                      <span className="text-status-destructive font-medium">{fmtCurrency(balance, booking.currency)}</span>
                    </div>
                  )}
                  {deposits.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs text-muted-foreground font-medium">Payment History</p>
                      {deposits.map((tx) => (
                        <div key={tx.id} className="flex justify-between text-xs text-muted-foreground">
                          <span>{tx.trans_date ? fmtDate(tx.trans_date) : '—'}</span>
                          <span>{tx.description ?? tx.category}</span>
                          <span className="font-mono">{fmtCurrency(tx.credit_amount, booking.currency)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              );
            })()}
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

        {/* Room */}
        <Card>
          <CardHeader>
            <CardTitle>Room</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {booking.room_name ? (
              <p className="font-semibold">{booking.room_name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No room assigned</p>
            )}
            {booking.booking_type && <Row label="Booking Type" value={booking.booking_type} />}
            {booking.lodging_type_name && <Row label="Lodging" value={booking.lodging_type_name} />}
          </CardContent>
        </Card>

        {/* Room Layout */}
        <Card>
          <CardHeader>
            <CardTitle>Room Layout</CardTitle>
          </CardHeader>
          <CardContent>
            {booking.layout_json && booking.room_beds && booking.room_beds.length > 0 ? (
              <div style={{ border: '1px solid #e7e5e4', borderRadius: 6, overflow: 'hidden' }}>
                <LayoutViewer
                  layoutJson={booking.layout_json as unknown as LayoutJson}
                  unit={(booking.layout_unit as LayoutUnit) ?? 'meters'}
                  beds={booking.room_beds}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No room layout available</p>
            )}
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

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
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
