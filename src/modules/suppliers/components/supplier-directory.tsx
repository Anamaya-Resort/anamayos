'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/shared/chip';
import type { Supplier, SupplierItem } from '../types';
import { ItemDialog, SupplierDialog } from './detail-dialogs';
import type { SupplierLabels } from './format';
import { SupplierCard } from './supplier-card';

type Filter = 'all' | 'excursions' | 'transport' | 'notListed';
const FILTERS: Filter[] = ['all', 'excursions', 'transport', 'notListed'];

const match = (s: Supplier, f: Filter) =>
  f === 'notListed' ? !s.isActive : s.isActive && (f === 'all' || s.kinds.includes(f));

/** Excursion and transport suppliers: contact them, see their trips, prices and rules. */
export function SupplierDirectory({ suppliers, labels: l, locale }: { suppliers: Supplier[]; labels: SupplierLabels; locale: string }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [item, setItem] = useState<{ item: SupplierItem; supplier: string } | null>(null);
  const [info, setInfo] = useState<Supplier | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return suppliers
      .filter((s) => match(s, filter))
      .map((s) => {
        if (!needle || s.name.toLowerCase().includes(needle)) return s;
        const items = s.items.filter((i) => `${i.name} ${i.category}`.toLowerCase().includes(needle));
        return items.length ? { ...s, items } : null;
      })
      .filter((s): s is Supplier => !!s);
  }, [suppliers, q, filter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={l.search} aria-label={l.search} className="h-11 pl-9 text-base md:text-sm" />
      </div>

      <div className="flex flex-wrap gap-2" role="group">
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
            {l[f]} <span className="ml-1 tabular-nums opacity-70">{suppliers.filter((s) => match(s, f)).length}</span>
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">{l.noResults}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((s) => (
            <SupplierCard key={s.id} supplier={s} labels={l} onItem={(i) => setItem({ item: i, supplier: s.name })} onInfo={() => setInfo(s)} />
          ))}
        </div>
      )}

      <ItemDialog item={item?.item ?? null} supplier={item?.supplier ?? ''} labels={l} onClose={() => setItem(null)} />
      <SupplierDialog supplier={info} labels={l} locale={locale} onClose={() => setInfo(null)} />
    </div>
  );
}
