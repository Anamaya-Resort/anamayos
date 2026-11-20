'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDay } from '@/components/shared/date-picker';
import { cn } from '@/lib/utils';
import type { DeskCharge } from '../types';
import { clock, money } from './api';
import type { DeskLabels } from './labels';

export function FolioList({ charges, labels, locale, currency, highlightId, onCancel }: {
  charges: DeskCharge[] | null;
  labels: DeskLabels;
  locale: string;
  currency: string;
  highlightId: string | null;
  onCancel: (id: string) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<DeskCharge | null>(null);
  const [busy, setBusy] = useState(false);
  const list = charges ?? [];
  const parents = list.filter((c) => !c.parentId);
  const childrenOf = (id: string) => list.filter((c) => c.parentId === id);

  const sum = (f: (c: DeskCharge) => number) => list.reduce((n, c) => n + f(c), 0);
  const subtotal = sum((c) => c.net);
  const tips = sum((c) => c.tip);
  const tax = sum((c) => c.tax);

  const row = (c: DeskCharge, child = false) => (
    <div className={cn('flex items-start gap-3 py-2.5', child && 'py-1.5 pl-4 text-sm text-muted-foreground')}>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate', !child && 'font-medium')}>
          {c.quantity > 1 && `${c.quantity} × `}{c.name}
        </p>
        {!child && (c.start || c.providerName) && (
          <p className="truncate text-xs text-muted-foreground">
            {[c.date && formatDay(c.date, locale), c.start && clock(c.start, locale), c.providerName].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p>{money(c.net, currency)}</p>
        {c.tip > 0 && <p className="text-xs text-muted-foreground">+ {money(c.tip, currency)} {labels.tip.toLowerCase()}</p>}
      </div>
      {!child && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={labels.chargeActions}
            className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setConfirm(c)}>
              {labels.cancelCharge}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <section className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">{labels.folio}</h3>
      {charges && !parents.length && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{labels.noCharges}</p>
      )}
      {parents.length > 0 && (
        <>
          <ul className="divide-y divide-border px-4">
            {parents.map((c) => (
              <li key={c.id} className={cn('transition-colors', highlightId === c.id && '-mx-4 bg-accent px-4')}>
                {row(c)}
                {childrenOf(c.id).map((k) => <div key={k.id}>{row(k, true)}</div>)}
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-border px-4 py-3 text-sm tabular-nums">
            <div className="flex justify-between text-muted-foreground"><dt>{labels.subtotal}</dt><dd>{money(subtotal, currency)}</dd></div>
            {tips > 0 && <div className="flex justify-between text-muted-foreground"><dt>{labels.tips}</dt><dd>{money(tips, currency)}</dd></div>}
            {tax > 0 && <div className="flex justify-between text-muted-foreground"><dt>{labels.iva}</dt><dd>{money(tax, currency)}</dd></div>}
            <div className="flex justify-between pt-1 text-base font-semibold"><dt>{labels.total}</dt><dd>{money(subtotal + tips + tax, currency)}</dd></div>
          </dl>
        </>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.cancelTitle}</DialogTitle>
          </DialogHeader>
          {confirm && (
            <p className="text-sm">
              {confirm.name} · <span className="tabular-nums">{money(confirm.net, currency)}</span>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{labels.keep}</Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                setBusy(true);
                try { await onCancel(confirm.id); setConfirm(null); } finally { setBusy(false); }
              }}
            >
              {labels.cancelCharge}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
