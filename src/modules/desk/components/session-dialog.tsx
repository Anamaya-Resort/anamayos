'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { SpaRoom, SpaSession } from '../types';
import { clock } from './api';
import type { DeskLabels } from './labels';

/** Tap a booking on the day sheet: details, and cancel if needed. */
export function SessionDialog({ session, rooms, labels, locale, onClose, onCancel }: {
  session: SpaSession | null;
  rooms: SpaRoom[];
  labels: DeskLabels;
  locale: string;
  onClose: () => void;
  onCancel: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = session;
  const row = (k: string, v: string | null | undefined) => v ? (
    <div className="flex justify-between gap-4 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
  ) : null;

  return (
    <Dialog open={!!s} onOpenChange={(o) => { if (!o) { setConfirming(false); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        {s && (
          <>
            <DialogHeader>
              <DialogTitle>{confirming ? labels.cancelBookingTitle : s.guestName}</DialogTitle>
            </DialogHeader>
            <dl className="divide-y divide-border text-sm">
              {confirming && row('', s.guestName)}
              {row(labels.tileSpa, `${s.minutes}m ${s.treatment}`)}
              {s.addons.length > 0 && row(labels.addons, s.addons.join(', '))}
              {row(labels.time, `${clock(s.start, locale)} – ${clock(s.end, locale)}`)}
              {row(labels.therapist, s.therapistName)}
              {row(labels.room, rooms.find((r) => r.id === s.roomId)?.name)}
            </dl>
            <DialogFooter>
              {confirming ? (
                <>
                  <Button variant="outline" onClick={() => setConfirming(false)}>{labels.keep}</Button>
                  <Button variant="destructive" disabled={busy} onClick={async () => {
                    setBusy(true);
                    try { await onCancel(s.id); setConfirming(false); } finally { setBusy(false); }
                  }}>{labels.cancelBooking}</Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setConfirming(true)}>{labels.cancelBooking}</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
