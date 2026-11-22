'use client';

import { ChevronRight, Globe, Info, Mail, MessageCircle, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Supplier, SupplierItem } from '../types';
import { duration, priceLine, telLink, waLink, type SupplierLabels } from './format';

const ACTION = 'inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:border-brand-divider hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function SupplierCard({ supplier: s, labels: l, onItem, onInfo }: {
  supplier: Supplier;
  labels: SupplierLabels;
  onItem: (item: SupplierItem) => void;
  onInfo: () => void;
}) {
  const ext = { target: '_blank', rel: 'noopener' } as const;
  return (
    <article className={cn('flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4', !s.isActive && 'border-dashed')}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{s.name}</h2>
          {s.contactName && <p className="truncate text-sm text-muted-foreground">{s.contactName}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!s.isActive && <Badge variant="destructive">{l.notListed}</Badge>}
          {s.kinds.map((k) => <Badge key={k} variant="secondary">{l[k]}</Badge>)}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {s.whatsapp && <a href={waLink(s.whatsapp)} {...ext} className={ACTION}><MessageCircle className="size-4 text-brand-highlight" />{l.whatsapp}</a>}
        {(s.phone ?? s.whatsapp) && <a href={telLink((s.phone ?? s.whatsapp)!)} className={ACTION}><Phone className="size-4" />{l.call}</a>}
        {s.email && <a href={`mailto:${s.email}`} className={ACTION}><Mail className="size-4" />{l.email}</a>}
        {s.website && <a href={s.website} {...ext} className={ACTION}><Globe className="size-4" />{l.website}</a>}
        <button type="button" onClick={onInfo} className={ACTION}><Info className="size-4" />{l.info}</button>
      </div>

      {s.items.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {s.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onItem(item)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[item.category, duration(item.minutes), item.schedule].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">{priceLine(l, item)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
