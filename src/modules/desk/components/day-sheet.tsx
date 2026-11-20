'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/shared/date-picker';
import { cn } from '@/lib/utils';
import { DESK_CONFIG } from '../config';
import { addDays, fromMinutes, nowMinutesIn, todayIn, toMinutes } from '../time';
import type { DeskCatalog, SpaDay, SpaSession } from '../types';
import { clock, deskApi } from './api';
import { BookSheet, type BookTarget } from './book-sheet';
import { DutyHours } from './duty-hours';
import type { DeskLabels } from './labels';
import { SessionDialog } from './session-dialog';
import { useCatalogCache } from './use-catalog';

const OPEN = toMinutes(DESK_CONFIG.spaOpen);
const CLOSE = toMinutes(DESK_CONFIG.spaClose);
const STEP = DESK_CONFIG.slotMinutes;
const ROWS = (CLOSE - OPEN) / STEP;
const ROW = DESK_CONFIG.sheetRowRem;
const rem = (minutes: number) => `${(minutes / STEP) * ROW}rem`;
const LANE_REM = 1.25;

/**
 * The spa's daily sheet: rooms across, 15-minute rows down, therapists'
 * hours on the left, a note for the day on top. Tap an empty spot to book.
 */
export function DaySheet({ labels, locale }: { labels: DeskLabels; locale: string }) {
  const today = todayIn(DESK_CONFIG.timezone);
  const [date, setDateRaw] = useState(today);
  const [day, setDay] = useState<SpaDay | null>(null);
  const [catalog, setCatalog] = useState<DeskCatalog | null>(null);
  const [note, setNote] = useState('');
  const [target, setTarget] = useState<BookTarget | null>(null);
  const [open, setOpen] = useState<SpaSession | null>(null);
  const [now, setNow] = useState(() => nowMinutesIn(DESK_CONFIG.timezone));
  const catalogFor = useCatalogCache();
  const setDate = (d: string) => { setDay(null); setDateRaw(d); };

  const load = useCallback((d: string) => {
    deskApi.day(d).then((x) => { setDay(x); setNote(x.note); }).catch(() => setDay({ date: d, note: '', sessions: [], shifts: [] }));
  }, []);
  useEffect(() => { load(date); catalogFor(date).then(setCatalog).catch(() => {}); }, [date, load, catalogFor]);
  useEffect(() => { const t = setInterval(() => setNow(nowMinutesIn(DESK_CONFIG.timezone)), 60_000); return () => clearInterval(t); }, []);

  const rooms = catalog?.rooms ?? [];
  const therapists = catalog?.therapists ?? [];
  const lanes = [...new Set((day?.shifts ?? []).map((s) => s.personId))];
  const nameOf = (id: string | null) => therapists.find((t) => t.personId === id)?.name ?? '';
  const edit = async (body: Record<string, unknown>) => { await deskApi.dayEdit({ date, ...body }); load(date); };
  const saveNote = () => { if (day && note.trim() !== day.note) void edit({ action: 'note', note }); };

  // Phones skip the duty-lanes column (the On duty chips cover it).
  const roomCols = `repeat(${Math.max(rooms.length, 1)}, minmax(0, 1fr))`;
  const lanesCol = lanes.length > 0;
  const gridVars = {
    '--cols': `3.5rem ${roomCols}`,
    '--cols-sm': `3.5rem ${lanesCol ? `${lanes.length * LANE_REM}rem ` : ''}${roomCols}`,
  } as React.CSSProperties;
  const gridCls = 'grid [grid-template-columns:var(--cols)] sm:[grid-template-columns:var(--cols-sm)]';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="size-11" aria-label={labels.prevDay} onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft className="size-5" />
        </Button>
        <DatePicker value={date} onChange={setDate} locale={locale} label={labels.date} prevLabel={labels.prevMonth} nextLabel={labels.nextMonth} className="h-11 min-w-0 flex-1 sm:w-64 sm:flex-none" />
        <Button variant="outline" size="icon" className="size-11" aria-label={labels.nextDay} onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight className="size-5" />
        </Button>
        {date !== today && <Button variant="outline" className="h-11" onClick={() => setDate(today)}>{labels.today}</Button>}
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{day ? `${day.sessions.length} ${labels.sessionCount}` : ''}</span>
      </div>

      <input
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder={labels.dayNote}
        aria-label={labels.dayNote}
        className="h-12 w-full rounded-lg border border-brand-divider bg-brand-subtle px-4 text-center text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted"
      />

      {day && (
        <DutyHours
          shifts={day.shifts} therapists={therapists} labels={labels} locale={locale}
          onAdd={(v) => edit({ action: 'addShift', ...v })}
          onUpdate={(id, start, end) => edit({ action: 'updateShift', id, start, end })}
          onRemove={(id) => edit({ action: 'deleteShift', id })}
        />
      )}

      {!day || !catalog ? (
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {/* Room names */}
          <div className={cn(gridCls, 'sticky top-0 z-10 border-b border-border bg-card')} style={gridVars}>
            <div />
            {lanesCol && <div className="hidden sm:block" />}
            {rooms.map((r) => (
              <div key={r.id} className="truncate border-l border-border px-1.5 py-2 text-center text-xs font-semibold sm:text-sm">{r.name}</div>
            ))}
          </div>

          <div className={cn(gridCls, 'relative')} style={gridVars}>
            {/* Times */}
            <div>
              {Array.from({ length: ROWS }, (_, i) => {
                const m = OPEN + i * STEP;
                return (
                  <div key={i} style={{ height: `${ROW}rem` }}
                    className={cn('flex items-start justify-end border-t pr-1.5 text-[0.7rem] leading-none tabular-nums', m % 60 ? 'border-border/40 text-muted-foreground/70' : 'border-border font-semibold text-foreground')}>
                    <span className="pt-1">{clock(fromMinutes(m), locale).replace(/\s?[AP]M$/i, '')}</span>
                  </div>
                );
              })}
            </div>

            {/* Therapist duty lanes, like the pencil lines on the paper sheet */}
            {lanesCol && (
              <div className="relative hidden border-l border-border sm:block">
                {lanes.map((pid, i) => day.shifts.filter((s) => s.personId === pid).map((s) => {
                  const a = Math.max(OPEN, toMinutes(s.start));
                  const b = Math.min(CLOSE, toMinutes(s.end));
                  return b > a && (
                  <div key={s.id} className="absolute flex justify-center" style={{ left: `${i * LANE_REM}rem`, width: `${LANE_REM}rem`, top: rem(a - OPEN), height: rem(b - a) }}>
                    <div className="absolute inset-y-1 w-0.5 rounded-full bg-brand-divider" />
                    <span className="relative mt-2 bg-card py-1 text-[0.7rem] font-medium [writing-mode:vertical-rl] rotate-180">{nameOf(pid)}</span>
                  </div>
                  );
                }))}
              </div>
            )}

            {/* Rooms */}
            {rooms.map((r) => (
              <div key={r.id} className="relative border-l border-border">
                {Array.from({ length: ROWS }, (_, i) => {
                  const m = OPEN + i * STEP;
                  return (
                    <button
                      key={i} type="button" aria-label={`${labels.book} ${r.name} ${clock(fromMinutes(m), locale)}`}
                      onClick={() => setTarget({ date, start: fromMinutes(m), roomId: r.id, roomName: r.name })}
                      style={{ height: `${ROW}rem` }}
                      className={cn('block w-full border-t hover:bg-accent focus-visible:bg-accent focus-visible:outline-none', m % 60 ? 'border-border/40' : 'border-border')}
                    />
                  );
                })}
                {day.sessions.filter((s) => s.roomId === r.id).map((s) => {
                  const top = toMinutes(s.start) - OPEN;
                  const len = toMinutes(s.end) - toMinutes(s.start);
                  return (
                    <div key={s.id}>
                      <div aria-hidden className="pointer-events-none absolute inset-x-1 rounded-b-md bg-muted/70" style={{ top: rem(top + len), height: rem(DESK_CONFIG.bufferMinutes) }} />
                      <button
                        type="button" onClick={() => setOpen(s)}
                        className="absolute inset-x-1 overflow-hidden rounded-md border border-l-4 border-border border-l-brand-btn bg-card px-1.5 py-1 text-left shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ top: rem(top), height: rem(len) }}
                      >
                        <p className="truncate text-xs font-semibold sm:text-sm">{s.guestName}</p>
                        <p className="truncate text-[0.7rem] text-muted-foreground sm:text-xs">{s.minutes}m {s.treatment}</p>
                        {s.addons.map((a) => <p key={a} className="truncate text-[0.7rem] text-muted-foreground sm:text-xs">+ {a}</p>)}
                        {s.therapistName && <p className="truncate text-[0.7rem] font-medium text-brand-btn sm:text-xs">{s.therapistName}</p>}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {date === today && now > OPEN && now < CLOSE && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-brand-highlight" style={{ top: rem(now - OPEN) }} />
            )}
          </div>
        </div>
      )}

      <BookSheet
        target={target} catalog={catalog} catalogFor={catalogFor} labels={labels} locale={locale}
        onClose={() => setTarget(null)}
        onBooked={() => { setTarget(null); load(date); }}
      />
      <SessionDialog
        session={open} rooms={rooms} labels={labels} locale={locale}
        onClose={() => setOpen(null)}
        onCancel={async (id) => { await deskApi.cancel(id); setOpen(null); load(date); }}
      />
    </div>
  );
}
