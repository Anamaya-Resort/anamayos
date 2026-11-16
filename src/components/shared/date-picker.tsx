'use client';

import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Shared date picker: a themed month calendar in a Popover (never the
 * browser's grey native picker). Dates are plain YYYY-MM-DD strings.
 * Month and weekday names come from Intl, so they follow `locale`.
 */
interface DatePickerProps {
  value: string | null;
  onChange: (date: string) => void;
  min?: string;
  locale?: string;
  label: string;
  placeholder?: string;
  prevLabel: string;
  nextLabel: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};

export function formatDay(date: string, locale = 'en', opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const { y, m, d } = parse(date);
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(Date.UTC(y, m, d));
}

export function DatePicker({ value, onChange, min, locale = 'en', label, placeholder, prevLabel, nextLabel, className }: DatePickerProps) {
  const start = parse(value ?? min ?? new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: start.y, m: start.m });

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const daysIn = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + i)),
  );
  const shift = (n: number) => setView((v) => ({ y: v.y + Math.floor((v.m + n) / 12), m: (((v.m + n) % 12) + 12) % 12 }));
  const canBack = !min || iso(view.y, view.m, 1) > min.slice(0, 8) + '01';

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && value) setView({ y: parse(value).y, m: parse(value).m });
      }}
    >
      <PopoverTrigger
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left outline-none transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50',
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">{label}</span>
          <span className={cn('block truncate text-sm font-medium', !value && 'text-muted-foreground')}>
            {value ? formatDay(value, locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label={prevLabel} disabled={!canBack} onClick={() => shift(-1)}
            className="rounded-md p-1 text-foreground hover:bg-muted disabled:opacity-30">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold capitalize">{monthName}</span>
          <button type="button" aria-label={nextLabel} onClick={() => shift(1)} className="rounded-md p-1 text-foreground hover:bg-muted">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {weekdays.map((w, i) => <span key={i} className="py-1">{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const d = iso(view.y, view.m, i + 1);
            const disabled = !!min && d < min;
            const selected = d === value;
            return (
              <button key={d} type="button" disabled={disabled}
                onClick={() => { onChange(d); setOpen(false); }}
                className={cn(
                  'aspect-square rounded-md text-sm transition-colors',
                  selected ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
                  disabled && 'pointer-events-none opacity-30',
                )}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
