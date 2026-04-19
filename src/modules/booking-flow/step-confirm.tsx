'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import type { WizardState } from './booking-wizard';

interface StepConfirmProps {
  state: WizardState;
  onBack: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export function StepConfirm({ state, onBack }: StepConfirmProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; referenceCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retreatId: state.retreatId,
          roomId: state.roomId,
          bedIds: state.bedIds,
          checkIn: state.checkIn,
          checkOut: state.checkOut,
          numGuests: state.numGuests,
          bookingType: state.bookingType ?? 'Single Deluxe',
          bedArrangement: state.bedArrangement,
          guestInfo: state.guestInfo,
          participants: state.participants.filter((p) => p.fullName),
          needsApproval: state.needsApproval,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create booking');
        return;
      }

      const data = await res.json();
      setResult(data.booking);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="text-center space-y-6 py-12">
        <CheckCircle className="h-16 w-16 mx-auto text-status-success" />
        <div>
          <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
          <p className="text-muted-foreground mt-2">Reference: <span className="font-mono text-primary">{result.referenceCode}</span></p>
        </div>
        <Button onClick={() => router.push(`/dashboard/bookings/${result.id}`)}>
          View Booking Details
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review & Confirm</h2>
        <p className="text-sm text-muted-foreground">Please review your booking details before confirming.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Stay</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.retreatName && <p className="font-semibold">{state.retreatName}</p>}
            <p>{fmtDate(state.checkIn)} — {fmtDate(state.checkOut)}</p>
            <p className="text-muted-foreground">{state.numGuests} guest{state.numGuests > 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Room & Bed</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{state.roomName}</p>
            <p className="text-muted-foreground">
              {state.bookingType}
              {state.bedArrangement && ` — ${state.bedArrangement.replace('_', ' ')}`}
            </p>
            {state.needsApproval && (
              <p className="text-xs text-status-warning">Requires staff approval</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Guest</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{state.guestInfo.fullName}</p>
            <p className="text-muted-foreground">{state.guestInfo.email}</p>
            {state.guestInfo.phone && <p className="text-muted-foreground">{state.guestInfo.phone}</p>}
          </CardContent>
        </Card>

        {state.participants.length > 0 && state.participants[0].fullName && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Additional Guest</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-semibold">{state.participants[0].fullName}</p>
              {state.participants[0].email && <p className="text-muted-foreground">{state.participants[0].email}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {error && (
        <p className="text-sm text-status-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={submit} disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {state.needsApproval ? 'Request Booking' : 'Confirm Booking'}
        </Button>
      </div>
    </div>
  );
}
