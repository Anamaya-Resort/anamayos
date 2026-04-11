'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, EmptyState } from '@/components/shared';
import { BookingFilters } from './booking-filters';
import { BookingTable } from './booking-table';
import { BookingForm } from './booking-form';
import type { BookingListItem, BookingFilters as Filters } from './types';
import type { TranslationKeys } from '@/i18n/en';
import { Plus } from 'lucide-react';

interface BookingsListViewProps {
  initialBookings: BookingListItem[];
  rooms: Array<{ id: string; name: string }>;
  dict: TranslationKeys;
}

export function BookingsListView({ initialBookings, rooms, dict }: BookingsListViewProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
  });
  const [createOpen, setCreateOpen] = useState(false);

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
        description={`${initialBookings.length} ${dict.bookings.total.toLowerCase()}`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="ao-btn-fx--strong">
            <Plus className="mr-2 h-4 w-4" />
            {dict.bookings.newBooking}
          </Button>
        }
      />

      <BookingFilters filters={filters} onChange={setFilters} dict={dict} />

      {filtered.length === 0 ? (
        <EmptyState title={dict.bookings.noBookings} description={dict.bookings.noBookingsDesc} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <BookingTable bookings={filtered} dict={dict} />
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dict.bookings.newBooking}</DialogTitle>
          </DialogHeader>
          <BookingForm
            rooms={rooms}
            dict={dict}
            onSaved={() => { setCreateOpen(false); router.refresh(); }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
