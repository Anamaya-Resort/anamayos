'use client';

import { ArrowLeft, Gift, Leaf, Mountain, Coffee } from 'lucide-react';
import { formatDay } from '@/components/shared/date-picker';
import { cn } from '@/lib/utils';
import type { DeskTile } from '../config';
import type { DeskCatalog, DeskGuest } from '../types';
import { GuestAvatar } from './guest-list';
import type { DeskLabels } from './labels';

export const TILES: { key: DeskTile; icon: typeof Leaf; label: keyof DeskLabels }[] = [
  { key: 'spa', icon: Leaf, label: 'tileSpa' },
  { key: 'excursions', icon: Mountain, label: 'tileExcursions' },
  { key: 'shop', icon: Gift, label: 'tileShop' },
  { key: 'snacks', icon: Coffee, label: 'tileSnacks' },
];

export function GuestHeader({ guest, labels, locale, onBack }: { guest: DeskGuest; labels: DeskLabels; locale: string; onBack: () => void }) {
  const range = `${formatDay(guest.checkIn, locale, { day: 'numeric', month: 'short' })} – ${formatDay(guest.checkOut, locale, { day: 'numeric', month: 'short' })}`;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={labels.back}
        className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <ArrowLeft className="size-5" />
      </button>
      <GuestAvatar guest={guest} size="lg" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{guest.name}</h2>
        <p className="truncate text-sm text-muted-foreground">{[guest.room, range].filter(Boolean).join(' · ')}</p>
        {guest.retreat && <p className="truncate text-xs text-muted-foreground">{guest.retreat}</p>}
      </div>
    </div>
  );
}

export function TileGrid({ labels, catalog, onPick }: { labels: DeskLabels; catalog: DeskCatalog | null; onPick: (t: DeskTile) => void }) {
  const count = (t: DeskTile) =>
    !catalog ? null : t === 'spa' ? catalog.treatments.length : catalog.items.filter((i) => i.tile === t).length;
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      {TILES.map(({ key, icon: Icon, label }) => {
        const n = count(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className={cn(
              'group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-3 transition-colors',
              'hover:border-brand-btn hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              n === 0 && 'opacity-60',
            )}
          >
            <Icon className="size-8 text-brand-btn transition-transform group-hover:scale-110" strokeWidth={1.5} />
            <span className="text-base font-medium">{labels[label]}</span>
            {n != null && <span className="text-xs tabular-nums text-muted-foreground">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
