'use client';

import { Minus, Plane, Plus, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Airport } from '../types';
import type { GreenAirLabels } from './labels';

const field =
  'flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left outline-none transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50';

function FieldText({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="block truncate text-sm font-medium">{value}</span>
    </span>
  );
}

export function AirportPicker({ label, value, options, onChange, landing }: {
  label: string;
  value: string;
  options: Airport[];
  onChange: (code: string) => void;
  landing?: boolean;
}) {
  const current = options.find((a) => a.code === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={field}>
        <Plane className={`size-4 shrink-0 text-primary ${landing ? 'rotate-45' : '-rotate-45'}`} />
        <FieldText label={label} value={current ? `${current.name} (${current.code})` : value} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(String(v))}>
          {options.map((a) => (
            <DropdownMenuRadioItem key={a.code} value={a.code}>
              <span className="w-10 font-semibold text-primary">{a.code}</span>
              <span>{a.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PassengerPicker({ adults, onChange, labels }: {
  adults: number;
  onChange: (n: number) => void;
  labels: GreenAirLabels;
}) {
  const text = adults === 1 ? labels.adult : labels.adults.replace('{n}', String(adults));
  const step = 'flex size-8 items-center justify-center rounded-full border border-input text-primary hover:bg-muted disabled:opacity-30';
  return (
    <Popover>
      <PopoverTrigger className={field}>
        <Users className="size-4 shrink-0 text-primary" />
        <FieldText label={labels.passengers} value={text} />
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{text}</span>
          <div className="flex items-center gap-2">
            <button type="button" className={step} aria-label={labels.fewer} disabled={adults <= 1} onClick={() => onChange(adults - 1)}>
              <Minus className="size-4" />
            </button>
            <span className="w-5 text-center text-sm font-semibold">{adults}</span>
            <button type="button" className={step} aria-label={labels.more} disabled={adults >= 9} onClick={() => onChange(adults + 1)}>
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
