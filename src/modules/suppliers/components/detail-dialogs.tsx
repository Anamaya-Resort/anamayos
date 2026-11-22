'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDay } from '@/components/shared/date-picker';
import type { Supplier, SupplierItem } from '../types';
import { DetailRows } from './detail-rows';
import { duration, money, unitLabel, type SupplierLabels } from './format';

const CONTENT = 'max-h-[85dvh] overflow-y-auto sm:max-w-lg';

/** Everything reception needs to tell a guest about one trip. */
export function ItemDialog({ item, supplier, labels: l, onClose }: {
  item: SupplierItem | null;
  supplier: string;
  labels: SupplierLabels;
  onClose: () => void;
}) {
  const unit = item ? unitLabel(l, item.priceUnit) : null;
  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={CONTENT}>
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{item.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">{[supplier, item.category].filter(Boolean).join(' · ')}</p>
            </DialogHeader>

            {item.options.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {item.options.map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <span>{o.name}</span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="font-medium">{money(o.price)}</span>
                      {o.net != null && <span className="ml-2 text-xs text-muted-foreground">{l.net} {money(o.net)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-lg font-semibold tabular-nums">
                {item.onRequest || item.price == null ? l.onRequest : money(item.price)}
                {item.price != null && !item.onRequest && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{l.plusIva}{unit ? ` · ${unit}` : ''}</span>}
                {item.net != null && <span className="ml-3 text-sm font-normal text-muted-foreground">{l.net} {money(item.net)}</span>}
              </p>
            )}

            {item.description && <p className="whitespace-pre-line text-sm">{item.description}</p>}

            <DetailRows rows={[
              [l.priceNotes, item.priceNotes],
              [l.schedule, item.schedule],
              [l.duration, duration(item.minutes)],
              [l.season, item.season],
              [l.minPeople, item.minPeople],
              [l.maxPeople, item.maxPeople],
              [l.minAge, item.minAge],
              [l.includes, item.includes],
              [l.bring, item.bring],
              [l.meetingPoint, item.meetingPoint],
              [l.cancellation, item.cancellation],
              [l.internalNotes, item.internalNotes],
            ]} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Supplier policies, reception notes and what we found on their website. */
export function SupplierDialog({ supplier: s, labels: l, locale, onClose }: {
  supplier: Supplier | null;
  labels: SupplierLabels;
  locale: string;
  onClose: () => void;
}) {
  const policy = (k: string) => s?.policies[k];
  return (
    <Dialog open={!!s} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={CONTENT}>
        {s && (
          <>
            <DialogHeader>
              <DialogTitle>{s.name}</DialogTitle>
              {s.legalName && <p className="text-sm text-muted-foreground">{s.legalName}</p>}
            </DialogHeader>
            <DetailRows rows={[
              [l.contact, s.contactName],
              [l.whatsapp, s.whatsapp],
              [l.phone, s.phone !== s.whatsapp ? s.phone : null],
              [l.email, s.email],
              [l.address, s.address],
              [l.bookingNotes, s.bookingNotes],
              [l.paymentTerms, s.paymentTerms],
              [l.cancellation, s.cancellation],
              [l.policy_wait, policy('wait')],
              [l.policy_luggage, policy('luggage')],
              [l.policy_children, policy('children')],
              [l.policy_pets, policy('pets')],
              [l.notes, s.notes],
              [l.checked, s.verifiedAt ? formatDay(s.verifiedAt, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null],
              [l.findings, s.verificationNotes],
            ]} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
