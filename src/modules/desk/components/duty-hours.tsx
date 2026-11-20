'use client';

import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DESK_CONFIG } from '../config';
import { fromMinutes, toMinutes } from '../time';
import type { SpaProvider, TherapistShift } from '../types';
import { Chip } from './chip';
import { clock } from './api';
import type { DeskLabels } from './labels';

const TIMES = (() => {
  const out: string[] = [];
  for (let m = toMinutes(DESK_CONFIG.spaOpen); m <= toMinutes(DESK_CONFIG.spaClose); m += DESK_CONFIG.slotMinutes) out.push(fromMinutes(m));
  return out;
})();

function TimeSelect({ value, onChange, label, locale }: { value: string; onChange: (t: string) => void; label: string; locale: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-sm tabular-nums hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span><span className="mr-2 text-xs text-muted-foreground">{label}</span>{clock(value, locale)}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 overflow-y-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(String(v))}>
          {TIMES.map((t) => (
            <DropdownMenuRadioItem key={t} value={t} className="tabular-nums">{clock(t, locale)}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Add or edit one stretch of hours. */
function ShiftEditor({ therapists, shift, labels, locale, onSave, onRemove }: {
  therapists: SpaProvider[];
  shift: TherapistShift | null;
  labels: DeskLabels;
  locale: string;
  onSave: (v: { personId: string; start: string; end: string }) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const [personId, setPersonId] = useState(shift?.personId ?? '');
  const [start, setStart] = useState(shift?.start ?? '09:00');
  const [end, setEnd] = useState(shift?.end ?? '17:00');
  const [saving, setSaving] = useState(false);
  const run = async (f: () => Promise<void>) => { setSaving(true); try { await f(); } finally { setSaving(false); } };

  return (
    <div className="space-y-3">
      {!shift && (
        <div className="flex flex-wrap gap-2">
          {therapists.map((t) => (
            <Chip key={t.personId} selected={personId === t.personId} onClick={() => setPersonId(t.personId)}>{t.name}</Chip>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <TimeSelect value={start} onChange={setStart} label={labels.from} locale={locale} />
        <TimeSelect value={end} onChange={setEnd} label={labels.to} locale={locale} />
      </div>
      <div className="flex justify-end gap-2">
        {onRemove && <Button variant="outline" disabled={saving} onClick={() => run(onRemove)}>{labels.remove}</Button>}
        <Button disabled={saving || !personId || end <= start} onClick={() => run(() => onSave({ personId, start, end }))}>{labels.save}</Button>
      </div>
    </div>
  );
}

/** "On duty" strip: who works when today. Tap a name to change it. */
export function DutyHours({ shifts, therapists, labels, locale, onAdd, onUpdate, onRemove }: {
  shifts: TherapistShift[];
  therapists: SpaProvider[];
  labels: DeskLabels;
  locale: string;
  onAdd: (v: { personId: string; start: string; end: string }) => Promise<void>;
  onUpdate: (id: string, start: string, end: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const nameOf = (id: string) => therapists.find((t) => t.personId === id)?.name ?? '';
  const close = () => setOpen(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.onDuty}</span>
      {shifts.map((s) => (
        <Popover key={s.id} open={open === s.id} onOpenChange={(o) => setOpen(o ? s.id : null)}>
          <PopoverTrigger className="flex min-h-9 items-center gap-1.5 rounded-full border border-brand-divider bg-card px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="font-medium">{nameOf(s.personId)}</span>
            <span className="tabular-nums text-muted-foreground">{clock(s.start, locale)}–{clock(s.end, locale)}</span>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <p className="mb-2 font-medium">{nameOf(s.personId)}</p>
            <ShiftEditor
              therapists={therapists} shift={s} labels={labels} locale={locale}
              onSave={async (v) => { await onUpdate(s.id, v.start, v.end); close(); }}
              onRemove={async () => { await onRemove(s.id); close(); }}
            />
          </PopoverContent>
        </Popover>
      ))}
      <Popover open={open === 'new'} onOpenChange={(o) => setOpen(o ? 'new' : null)}>
        <PopoverTrigger className="flex min-h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Plus className="size-4" />{labels.addHours}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <ShiftEditor
            key={String(open === 'new')}
            therapists={therapists} shift={null} labels={labels} locale={locale}
            onSave={async (v) => { await onAdd(v); close(); }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
