'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import type { BookingStatus } from '@/types';
import type { BookingFilters as Filters } from './types';
import type { TranslationKeys } from '@/i18n/en';

const statuses: Array<BookingStatus | 'all'> = [
  'all',
  'inquiry',
  'quote_sent',
  'confirmed',
  'deposit_paid',
  'paid_in_full',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
];

interface BookingFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  dict: TranslationKeys;
}

export function BookingFilters({ filters, onChange, dict }: BookingFiltersProps) {
  /**
   * Status labels are looked up by a key built at runtime, so the type of
   * the whole namespace cannot narrow it. Reading through `unknown` with a
   * guard keeps that honest: not every key under `bookings` is a string,
   * and falling back to the raw status beats rendering an object.
   */
  const statusLabel = (status: string): string => {
    const v = (dict.bookings as Record<string, unknown>)[`status_${status}`];
    return typeof v === 'string' ? v : status;
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={dict.bookings.searchPlaceholder}
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {statuses.map((status) => {
          const label = status === 'all' ? dict.bookings.allStatuses : statusLabel(status);
          return (
            <Button
              key={status}
              variant={filters.status === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...filters, status })}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
