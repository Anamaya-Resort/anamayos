'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SignaturePad } from '@/components/shared';
import { formatCurrency } from '@/lib/pricing';
import { Check, Clock, Printer } from 'lucide-react';
import type { FolioLineItem, FolioSummary, Booking } from '@/types';
import type { TranslationKeys } from '@/i18n/en';

interface FolioViewProps {
  booking: Pick<Booking, 'id' | 'reference_code' | 'check_in' | 'check_out' | 'currency'>;
  guestName: string;
  lineItems: FolioLineItem[];
  summary: FolioSummary;
  dict: TranslationKeys;
  canApprove?: boolean;
  personId?: string;
}

export function FolioView({
  booking,
  guestName,
  lineItems,
  summary,
  dict,
  canApprove = false,
  personId,
}: FolioViewProps) {
  const f = dict.folio;
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [items, setItems] = useState(lineItems);

  // Group items by date
  const grouped = new Map<string, FolioLineItem[]>();
  for (const item of items) {
    const date = item.scheduled_date ?? item.created_at.slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(item);
  }

  async function handleApprove(lineItemId: string, signature: string) {
    let coords: string | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }),
      );
      coords = `${pos.coords.latitude},${pos.coords.longitude}`;
    } catch { /* ok */ }

    const res = await fetch('/api/folio/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_item_id: lineItemId,
        signature,
        location_coords: coords,
      }),
    });

    if (res.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === lineItemId
            ? { ...i, approved_at: new Date().toISOString(), approved_signature: signature, approval_method: 'self' as const }
            : i,
        ),
      );
      setApprovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{f.title}</h2>
          <p className="text-sm text-muted-foreground">
            {booking.reference_code} — {guestName}
          </p>
          <p className="text-xs text-muted-foreground">
            {booking.check_in} → {booking.check_out}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          {f.printFolio}
        </Button>
      </div>

      {/* Line items by date */}
      {Array.from(grouped.entries()).map(([date, dateItems]) => (
        <Card key={date}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {dateItems.map((item) => (
              <div key={item.id} className="py-2 border-b border-border/30 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {item.approved_at ? (
                      <div className="mt-0.5 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        {item.approved_signature && (
                          <img
                            src={item.approved_signature}
                            alt="Initials"
                            className="h-5 w-auto opacity-70"
                          />
                        )}
                      </div>
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-500 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{item.product_name}</p>
                      {item.variant_name && (
                        <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                      )}
                      {item.approved_at && (
                        <p className="text-[10px] text-muted-foreground">
                          {f.signed} {new Date(item.approved_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {item.approved_location_name ? ` — ${item.approved_location_name}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{formatCurrency(item.total_amount, item.currency)}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x {formatCurrency(item.unit_price, item.currency)}
                      </p>
                    )}
                    {item.taxes.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {item.taxes.map((t) => `${t.tax_name} ${formatCurrency(t.tax_amount)}`).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Approval button for unsigned items */}
                {canApprove && !item.approved_at && (
                  <div className="mt-2">
                    {approvingId === item.id ? (
                      <SignaturePad
                        onCapture={(sig) => handleApprove(item.id, sig)}
                        onClear={() => setApprovingId(null)}
                        label={f.signHere}
                        clearLabel={f.clearSignature}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setApprovingId(item.id)}
                        className="text-xs"
                      >
                        {f.signatureRequired}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{f.noCharges}</p>
            <p className="text-xs text-muted-foreground mt-1">{f.noChargesDesc}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{f.subtotal}</span>
              <span>{formatCurrency(summary.subtotal, booking.currency)}</span>
            </div>
            {summary.taxBreakdown.map((t, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>{t.name}</span>
                <span>{formatCurrency(t.total, booking.currency)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{f.grandTotal}</span>
              <span>{formatCurrency(summary.grandTotal, booking.currency)}</span>
            </div>
            {summary.paymentsApplied > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{f.paymentsApplied}</span>
                <span>-{formatCurrency(summary.paymentsApplied, booking.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>{f.balanceDue}</span>
              <span>{formatCurrency(summary.balanceDue, booking.currency)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
