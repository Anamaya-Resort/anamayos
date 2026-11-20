'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/shared/date-picker';
import { DESK_CONFIG } from '../config';
import { findConflict, freeRoom } from '../conflicts';
import { fromMinutes, nowMinutesIn, todayIn, toMinutes } from '../time';
import type { DeskCatalog, DeskGuest, SpaDay, SpaTreatment } from '../types';
import { Chip } from './chip';
import { TipPicker } from './tip-picker';
import { clock, deskApi, money } from './api';
import { errorText, type DeskLabels } from './labels';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
      {children}
    </section>
  );
}

export function SpaBooking({ guest, treatment, initialServiceId, initialDate, initialStart, initialRoomId, catalogFor, labels, locale, onDone }: {
  guest: DeskGuest;
  treatment: SpaTreatment;
  initialServiceId: string;
  initialDate?: string;
  initialStart?: string;
  initialRoomId?: string | null;
  catalogFor: (date: string) => Promise<DeskCatalog>;
  labels: DeskLabels;
  locale: string;
  onDone: (chargeId: string) => void;
}) {
  const today = todayIn(DESK_CONFIG.timezone);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [providerId, setProviderId] = useState<string | null>(treatment.providers.length === 1 ? treatment.providers[0].personId : null);
  const [date, setDate] = useState(initialDate ?? (guest.checkIn > today ? guest.checkIn : today));
  const [start, setStart] = useState<string | null>(initialStart ?? null);
  const [roomId, setRoomId] = useState<string | null>(initialRoomId ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [tip, setTip] = useState(0);
  const [catalog, setCatalog] = useState<DeskCatalog | null>(null);
  const [day, setDay] = useState<SpaDay | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prices depend on the day (scheduled price changes), so reload per date.
  useEffect(() => { let on = true; catalogFor(date).then((c) => on && setCatalog(c)); return () => { on = false; }; }, [date, catalogFor]);
  useEffect(() => {
    let on = true;
    setDay(null);
    deskApi.day(date).then((d) => on && setDay(d)).catch(() => on && setDay({ date, note: '', sessions: [], shifts: [] }));
    return () => { on = false; };
  }, [date]);
  const busy = day?.sessions ?? null;

  const current = catalog?.treatments.find((t) => t.key === treatment.key) ?? treatment;
  // Whole spa team, the treatment's usual therapists first (green dot).
  const usual = new Set(current.providers.map((p) => p.personId));
  const team = [...current.providers, ...(catalog?.therapists ?? []).filter((t) => !usual.has(t.personId))];
  const option = current.options.find((o) => o.serviceId === serviceId) ?? current.options[0];
  const addons = (catalog?.addons ?? []).flatMap((a) => a.options.map((o) => ({ ...o, name: a.name })));
  const chosenAddons = addons.filter((a) => addonIds.includes(a.serviceId));
  const minutes = option.minutes + chosenAddons.reduce((n, a) => n + a.minutes, 0);
  const subtotal = option.price + chosenAddons.reduce((n, a) => n + a.price, 0);
  const currency = catalog?.currency ?? 'USD';
  const iva = Math.round(subtotal * (catalog?.ivaRate ?? 0) * 100) / 100;

  const slots = useMemo(() => {
    const open = toMinutes(DESK_CONFIG.spaOpen);
    const close = toMinutes(DESK_CONFIG.spaClose);
    const now = date === today ? nowMinutesIn(DESK_CONFIG.timezone) : -1;
    const out: { t: string; free: boolean }[] = [];
    const sessions = busy ?? [];
    const roomIds = (catalog?.rooms ?? []).map((r) => r.id);
    for (let s = open; s + minutes <= close; s += DESK_CONFIG.slotMinutes) {
      const room = roomId ?? (roomIds.length ? freeRoom(sessions, roomIds, s, s + minutes) : null);
      const fits = (!roomIds.length || !!room)
        && !findConflict(sessions, { start: s, end: s + minutes, therapistId: providerId, roomId: room, personId: guest.personId });
      out.push({ t: fromMinutes(s), free: s > now && fits });
    }
    return out;
  }, [busy, minutes, date, today, roomId, providerId, guest.personId, catalog]);

  // Drop a picked time that stopped fitting (longer session, new therapist, new day).
  useEffect(() => { if (start && busy && !slots.find((s) => s.t === start)?.free) setStart(null); }, [slots, start, busy]);

  const save = async () => {
    if (!start) return;
    setSaving(true);
    setError(null);
    try {
      const { id } = await deskApi.create({
        kind: 'spa', bookingId: guest.bookingId, serviceId: option.serviceId, providerId, roomId,
        date, start, addonServiceIds: addonIds, tip,
      });
      onDone(id);
    } catch (e) {
      setError(errorText(labels, (e as { code?: string }).code));
      deskApi.day(date).then(setDay).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">{current.name}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {current.options.map((o) => (
            <Chip key={o.serviceId} selected={o.serviceId === option.serviceId} onClick={() => setServiceId(o.serviceId)}>
              {o.minutes} {labels.min} · <span className="tabular-nums">{money(o.price, currency)}</span>
            </Chip>
          ))}
        </div>
      </div>

      <Field label={labels.therapist}>
        <div className="flex flex-wrap gap-2">
          {team.map((p) => (
            <Chip key={p.personId} selected={providerId === p.personId} onClick={() => setProviderId(p.personId)}>
              {p.name}
              {usual.has(p.personId) && <span aria-hidden className="ml-1.5 inline-block size-1.5 rounded-full bg-brand-highlight align-middle" />}
            </Chip>
          ))}
        </div>
      </Field>

      {(catalog?.rooms.length ?? 0) > 1 && (
        <Field label={labels.room}>
          <div className="flex flex-wrap gap-2">
            <Chip selected={roomId === null} onClick={() => setRoomId(null)}>{labels.anyRoom}</Chip>
            {catalog!.rooms.map((r) => (
              <Chip key={r.id} selected={roomId === r.id} onClick={() => setRoomId(r.id)}>{r.name}</Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label={labels.date}>
        <DatePicker
          value={date}
          min={today}
          onChange={setDate}
          locale={locale}
          label={labels.date}
          prevLabel={labels.prevMonth}
          nextLabel={labels.nextMonth}
          className="h-11 w-full sm:w-64"
        />
      </Field>

      <Field label={labels.time}>
        {!busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : slots.some((s) => s.free) ? (
          <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6 @3xl:grid-cols-8">
            {slots.map((s) => (
              <Chip key={s.t} disabled={!s.free} selected={start === s.t} onClick={() => setStart(s.t)} className="px-1 tabular-nums">
                {clock(s.t, locale)}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.noTimes}</p>
        )}
      </Field>

      {addons.length > 0 && (
        <Field label={labels.addons}>
          <div className="flex flex-wrap gap-2">
            {addons.map((a) => (
              <Chip
                key={a.serviceId}
                selected={addonIds.includes(a.serviceId)}
                onClick={() => setAddonIds((ids) => (ids.includes(a.serviceId) ? ids.filter((x) => x !== a.serviceId) : [...ids, a.serviceId]))}
              >
                {a.name} <span className="font-normal tabular-nums opacity-80">+{money(a.price, currency)}</span>
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label={labels.tip}>
        <TipPicker base={subtotal} currency={currency} labels={labels} value={tip} onChange={setTip} />
      </Field>

      {/* Sticky on phones so the main action is always under the thumb. */}
      <div className="sticky bottom-0 z-20 -mx-3 border-t border-border bg-background/95 p-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-card sm:p-4">
        {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <dl className="min-w-0 flex-1 text-sm tabular-nums">
            <div className="flex gap-2 text-muted-foreground">
              <dt>{labels.subtotal}</dt><dd>{money(subtotal, currency)}</dd>
              {tip > 0 && <><dt className="ml-2">{labels.tip}</dt><dd>{money(tip, currency)}</dd></>}
              {iva > 0 && <><dt className="ml-2">{labels.iva}</dt><dd>{money(iva, currency)}</dd></>}
            </div>
            <div className="flex gap-2 text-base font-semibold"><dt>{labels.total}</dt><dd>{money(subtotal + tip + iva, currency)}</dd></div>
          </dl>
          <Button size="lg" disabled={!start || saving || !catalog || !providerId} onClick={save} className="h-12 shrink-0 px-5 text-base">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {labels.addToFolio}
          </Button>
        </div>
      </div>
    </div>
  );
}
