'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DESK_CONFIG, type DeskTile } from '../config';
import { todayIn } from '../time';
import type { DeskCatalog, DeskCharge, DeskGuest, SpaTreatment } from '../types';
import { deskApi } from './api';
import { FolioList } from './folio-list';
import { GuestList } from './guest-list';
import { GuestHeader, TileGrid, TILES } from './guest-workspace';
import type { DeskLabels } from './labels';
import { ShopItems } from './shop-items';
import { SpaBooking } from './spa-booking';
import { TreatmentList } from './treatment-list';
import { useCatalogCache } from './use-catalog';

/**
 * Reception Desk: pick a guest, pick Spa / Excursions / Gift Shop / Snacks,
 * pick the item (and time + tip for spa), and it lands on their folio.
 * Phone: one step at a time. Tablet/desktop (lg+): guest list stays on the left.
 */
export function DeskView({ labels, locale }: { labels: DeskLabels; locale: string }) {
  const [guest, setGuest] = useState<DeskGuest | null>(null);
  const [tile, setTile] = useState<DeskTile | null>(null);
  const [pick, setPick] = useState<{ treatment: SpaTreatment; serviceId: string } | null>(null);
  const [charges, setCharges] = useState<DeskCharge[] | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [todayCatalog, setTodayCatalog] = useState<DeskCatalog | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const catalogFor = useCatalogCache();

  useEffect(() => { catalogFor(todayIn(DESK_CONFIG.timezone)).then(setTodayCatalog).catch(() => {}); }, [catalogFor]);

  const loadCharges = useCallback((bookingId: string) => {
    deskApi.charges(bookingId).then(setCharges).catch(() => setCharges([]));
  }, []);

  const go = (next: { tile?: DeskTile | null; pick?: typeof pick }) => {
    if ('tile' in next) setTile(next.tile ?? null);
    if ('pick' in next) setPick(next.pick ?? null);
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const selectGuest = (g: DeskGuest) => {
    setGuest(g);
    setCharges(null);
    setHighlight(null);
    go({ tile: null, pick: null });
    loadCharges(g.bookingId);
  };

  const done = (id: string) => {
    if (!guest) return;
    setHighlight(id);
    loadCharges(guest.bookingId);
    go({ tile: null, pick: null });
  };

  const back = () => (pick ? go({ pick: null }) : go({ tile: null }));
  const tileLabel = tile ? labels[TILES.find((t) => t.key === tile)!.label] : '';
  const currency = todayCatalog?.currency ?? 'USD';

  return (
    <div ref={top} className="grid scroll-mt-20 gap-6 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
      <GuestList
        labels={labels}
        locale={locale}
        selectedId={guest?.bookingId ?? null}
        onSelect={selectGuest}
        className={cn('lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:self-start', guest && 'hidden lg:flex')}
      />

      <div className={cn('@container min-w-0', !guest && 'hidden lg:block')}>
        {!guest ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            {labels.pickGuest}
          </div>
        ) : (
          <div className="space-y-5">
            <GuestHeader guest={guest} labels={labels} locale={locale} onBack={() => setGuest(null)} />

            {tile && (
              <button
                type="button"
                onClick={back}
                className="-ml-2 flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-brand-btn hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="size-4" />
                {pick ? labels.tileSpa : labels.back}
                {!pick && <span className="sr-only">{tileLabel}</span>}
              </button>
            )}

            {!tile && (
              <>
                <TileGrid labels={labels} catalog={todayCatalog} onPick={(t) => go({ tile: t })} />
                <FolioList
                  charges={charges}
                  labels={labels}
                  locale={locale}
                  currency={currency}
                  highlightId={highlight}
                  onCancel={async (id) => { await deskApi.cancel(id); loadCharges(guest.bookingId); }}
                />
              </>
            )}

            {tile && !todayCatalog && <Loader2 className="size-6 animate-spin text-muted-foreground" />}

            {tile === 'spa' && todayCatalog && !pick && (
              <TreatmentList
                treatments={todayCatalog.treatments}
                currency={currency}
                labels={labels}
                onPick={(treatment, o) => go({ pick: { treatment, serviceId: o.serviceId } })}
              />
            )}

            {tile === 'spa' && pick && (
              <SpaBooking
                key={pick.treatment.key}
                guest={guest}
                treatment={pick.treatment}
                initialServiceId={pick.serviceId}
                catalogFor={catalogFor}
                labels={labels}
                locale={locale}
                onDone={done}
              />
            )}

            {tile && tile !== 'spa' && todayCatalog && (
              <ShopItems
                guest={guest}
                items={todayCatalog.items.filter((i) => i.tile === tile)}
                currency={currency}
                labels={labels}
                onDone={done}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
