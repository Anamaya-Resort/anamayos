'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDay } from '@/components/shared/date-picker';
import { cn } from '@/lib/utils';
import type { DeskGuest } from '../types';
import { deskApi } from './api';
import type { DeskLabels } from './labels';

export function GuestAvatar({ guest, size = 'md' }: { guest: DeskGuest; size?: 'md' | 'lg' }) {
  const initials = guest.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand-btn ring-1 ring-brand-divider dark:bg-muted',
        size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm',
      )}
    >
      {initials}
    </span>
  );
}

export function GuestList({ labels, locale, selectedId, onSelect, className }: {
  labels: DeskLabels;
  locale: string;
  selectedId: string | null;
  onSelect: (g: DeskGuest) => void;
  className?: string;
}) {
  const [q, setQ] = useState('');
  const [guests, setGuests] = useState<DeskGuest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      deskApi.guests(q)
        .then((g) => { if (id === seq.current) setGuests(g); })
        .catch(() => { if (id === seq.current) setGuests([]); })
        .finally(() => { if (id === seq.current) setLoading(false); });
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const inHouse = guests?.filter((g) => g.inHouse) ?? [];
  const upcoming = guests?.filter((g) => !g.inHouse) ?? [];

  const section = (title: string, list: DeskGuest[]) => list.length > 0 && (
    <div className="space-y-1">
      <h3 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="font-normal">· {list.length}</span>
      </h3>
      <ul className="space-y-1">
        {list.map((g) => (
          <li key={g.bookingId}>
            <button
              type="button"
              onClick={() => onSelect(g)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selectedId === g.bookingId
                  ? 'border-brand-btn bg-accent'
                  : 'border-transparent hover:border-border hover:bg-accent',
              )}
            >
              <GuestAvatar guest={g} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{g.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[g.room, g.retreat].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                {labels.checkOut}
                <span className="block font-medium text-foreground">{formatDay(g.checkOut, locale, { day: 'numeric', month: 'short' })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.searchGuests}
          aria-label={labels.searchGuests}
          className="h-11 pl-9 text-base md:text-sm"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {section(labels.inHouse, inHouse)}
        {section(labels.upcoming, upcoming)}
        {guests && !guests.length && !loading && (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">{labels.noGuests}</p>
        )}
      </div>
    </section>
  );
}
