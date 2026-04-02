'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, EmptyState } from '@/components/shared';
import { BookingFilters } from './booking-filters';
import { BookingTable } from './booking-table';
import type { BookingListItem, BookingFilters as Filters } from './types';
import type { TranslationKeys } from '@/i18n/en';
import { Plus } from 'lucide-react';

interface BookingsListViewProps {
  initialBookings: BookingListItem[];
  dict: TranslationKeys;
}

export function BookingsListView({ initialBookings, dict }: BookingsListViewProps) {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
  });

  // Client-side filtering for now; will move to server query later
  const filtered = initialBookings.filter((b) => {
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        b.reference_code.toLowerCase().includes(q) ||
        (b.guest_name?.toLowerCase().includes(q) ?? false) ||
        b.guest_email.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.bookings.title}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {dict.bookings.newBooking}
          </Button>
        }
      />

      <BookingFilters filters={filters} onChange={setFilters} dict={dict} />

      {filtered.length === 0 ? (
        <EmptyState
          title={dict.bookings.noBookings}
          description={dict.bookings.noBookingsDesc}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <BookingTable bookings={filtered} dict={dict} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
