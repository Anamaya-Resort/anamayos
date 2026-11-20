'use client';

import { useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DeskGuest, ShopItem } from '../types';
import { deskApi, money } from './api';
import { errorText, type DeskLabels } from './labels';

/** Excursions / gift shop / snacks: tap +/- then add straight to the folio. */
export function ShopItems({ guest, items, currency, labels, onDone }: {
  guest: DeskGuest;
  items: ShopItem[];
  currency: string;
  labels: DeskLabels;
  onDone: (chargeId: string) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) {
    return <p className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">{labels.noItems}</p>;
  }

  const add = async (item: ShopItem) => {
    setSaving(item.productId);
    setError(null);
    try {
      const { id } = await deskApi.create({ kind: 'item', bookingId: guest.bookingId, productId: item.productId, quantity: qty[item.productId] ?? 1, tip: 0 });
      setQty((q) => ({ ...q, [item.productId]: 1 }));
      onDone(id);
    } catch (e) {
      setError(errorText(labels, (e as { code?: string }).code));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <ul className="grid gap-2 @xl:grid-cols-2">
        {items.map((item) => {
          const n = qty[item.productId] ?? 1;
          return (
            <li key={item.productId} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{money(item.price, currency)}</p>
              </div>
              <div className="flex items-center gap-1" role="group" aria-label={labels.quantity}>
                <Button variant="outline" size="icon" className="size-10" disabled={n <= 1} onClick={() => setQty((q) => ({ ...q, [item.productId]: n - 1 }))}>
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center tabular-nums">{n}</span>
                <Button variant="outline" size="icon" className="size-10" onClick={() => setQty((q) => ({ ...q, [item.productId]: Math.min(99, n + 1) }))}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button className="h-10" disabled={saving === item.productId} onClick={() => add(item)}>
                {saving === item.productId && <Loader2 className="size-4 animate-spin" />}
                {money(item.price * n, currency)}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
