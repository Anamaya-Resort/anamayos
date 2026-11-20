'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { DeskCatalog, DeskGuest, SpaTreatment } from '../types';
import { clock } from './api';
import { GuestList } from './guest-list';
import { GuestHeader } from './guest-workspace';
import type { DeskLabels } from './labels';
import { SpaBooking } from './spa-booking';
import { TreatmentList } from './treatment-list';

export interface BookTarget { date: string; start: string; roomId: string | null; roomName: string | null }

/** Tap an empty spot on the day sheet: guest, then treatment, then confirm. */
export function BookSheet({ target, catalog, catalogFor, labels, locale, onClose, onBooked }: {
  target: BookTarget | null;
  catalog: DeskCatalog | null;
  catalogFor: (date: string) => Promise<DeskCatalog>;
  labels: DeskLabels;
  locale: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [guest, setGuest] = useState<DeskGuest | null>(null);
  const [pick, setPick] = useState<{ treatment: SpaTreatment; serviceId: string } | null>(null);
  const reset = () => { setGuest(null); setPick(null); };

  return (
    <Sheet open={!!target} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b border-border p-4 pr-12">
          <SheetTitle>{labels.bookTreatment}</SheetTitle>
          {target && (
            <p className="text-sm tabular-nums text-muted-foreground">
              {clock(target.start, locale)}{target.roomName ? ` · ${target.roomName}` : ''}
            </p>
          )}
        </SheetHeader>
        <div className="@container space-y-4 p-3 sm:p-4">
          {target && !guest && <GuestList labels={labels} locale={locale} selectedId={null} onSelect={setGuest} />}
          {guest && (
            <>
              <GuestHeader guest={guest} labels={labels} locale={locale} onBack={reset} />
              {pick && (
                <button type="button" onClick={() => setPick(null)} className="-ml-2 flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-brand-btn hover:bg-accent">
                  <ChevronLeft className="size-4" />{labels.tileSpa}
                </button>
              )}
              {!pick && catalog && (
                <TreatmentList treatments={catalog.treatments} currency={catalog.currency} labels={labels}
                  onPick={(treatment, o) => setPick({ treatment, serviceId: o.serviceId })} />
              )}
              {pick && target && (
                <SpaBooking
                  key={pick.treatment.key}
                  guest={guest} treatment={pick.treatment} initialServiceId={pick.serviceId}
                  initialDate={target.date} initialStart={target.start} initialRoomId={target.roomId}
                  catalogFor={catalogFor} labels={labels} locale={locale}
                  onDone={() => { reset(); onBooked(); }}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
