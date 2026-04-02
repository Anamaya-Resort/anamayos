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
          const label =
            status === 'all'
              ? dict.bookings.allStatuses
              : dict.bookings[`status_${status}` as keyof typeof dict.bookings];
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
