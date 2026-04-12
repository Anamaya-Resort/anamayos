'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/pricing';
import { Check, Clock, FileText } from 'lucide-react';
import type { FolioLineItem } from '@/types';
import type { TranslationKeys } from '@/i18n/en';

interface LineItemsCardProps {
  bookingId: string;
  dict: TranslationKeys;
  refreshKey?: number;
}

export function LineItemsCard({ bookingId, dict, refreshKey }: LineItemsCardProps) {
  const [items, setItems] = useState<FolioLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const f = dict.folio;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/line-items?booking_id=${bookingId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .finally(() => setLoading(false));
  }, [bookingId, refreshKey]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{f.lineItems}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{dict.common.loading}</p></CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{f.lineItems}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{f.noCharges}</p>
          <p className="text-xs text-muted-foreground mt-1">{f.noChargesDesc}</p>
        </CardContent>
      </Card>
    );
  }

  const total = items.reduce((s, i) => s + i.total_amount, 0);
  const totalTax = items.reduce((s, i) => s + i.tax_amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {f.lineItems}
          <a href={`/dashboard/bookings/${bookingId}/folio`}>
            <Button variant="ghost" size="sm">
              <FileText className="mr-1 h-4 w-4" />
              {f.viewFolio}
            </Button>
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-2">
                {item.approved_at ? (
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  {item.variant_name && (
                    <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(item.total_amount, item.currency)}</p>
                {item.quantity > 1 && (
                  <p className="text-xs text-muted-foreground">{item.quantity} x {formatCurrency(item.unit_price, item.currency)}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
          {totalTax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{f.tax}</span>
              <span>{formatCurrency(totalTax)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>{f.total}</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
