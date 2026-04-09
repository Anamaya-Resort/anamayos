'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared';
import { CalendarHeader } from './calendar-header';
import { CalendarRoomRow } from './calendar-room-row';
import type { CalendarRoom, CalendarBooking, CalendarRoomBlock } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface CalendarGridProps {
  rooms: CalendarRoom[];
  bookings: CalendarBooking[];
  roomBlocks: CalendarRoomBlock[];
  dict: TranslationKeys;
}

function generateDates(startDate: string, numDays: number): string[] {
  const dates: string[] = [];
  const d = new Date(startDate + 'T12:00:00');
  for (let i = 0; i < numDays; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function CalendarGrid({
  rooms,
  bookings,
  roomBlocks,
  dict,
}: CalendarGridProps) {
  const [numDays, setNumDays] = useState(30);
  const [startDate, setStartDate] = useState(getToday);

  const dates = useMemo(() => generateDates(startDate, numDays), [startDate, numDays]);

  function navigate(direction: number) {
    const d = new Date(startDate + 'T12:00:00');
    d.setDate(d.getDate() + direction * numDays);
    setStartDate(d.toISOString().split('T')[0]);
  }

  function goToToday() {
    setStartDate(getToday());
  }

  // Count bookings per date
  const bookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const date of dates) {
      let count = 0;
      for (const b of bookings) {
        if (b.checkIn <= date && b.checkOut > date && b.status !== 'cancelled') {
          count++;
        }
      }
      counts.set(date, count);
    }
    return counts;
  }, [dates, bookings]);

  return (
    <div className="space-y-4">
      <PageHeader title={dict.calendar.title} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {dict.calendar.prev}
        </Button>
        <Button variant="outline" size="sm" onClick={goToToday}>
          {dict.calendar.today}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(1)}>
          {dict.calendar.next}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">{dict.calendar.show}</span>
          {[14, 30, 60, 90].map((n) => (
            <Button
              key={n}
              variant={numDays === n ? 'default' : 'outline'}
              size="sm"
              onClick={() => setNumDays(n)}
            >
              {n}
            </Button>
          ))}
          <span className="text-sm text-muted-foreground">{dict.calendar.days}</span>
        </div>
      </div>

      {/* Calendar grid container */}
      <div className="cal-container">
        <div className="cal-scroll">
          <div
            className="cal-grid"
            style={{
              '--cal-num-days': numDays,
            } as React.CSSProperties}
          >
            {/* Header row with dates */}
            <CalendarHeader dates={dates} dict={dict} />

            {/* Occupancy summary row */}
            <div className="cal-summary-row">
              <div className="cal-room-label-cell cal-summary-label">
                <span className="text-xs text-muted-foreground">
                  {dict.calendar.occupied}
                </span>
              </div>
              {dates.map((dateStr) => (
                <div key={dateStr} className="cal-date-cell cal-summary-cell">
                  <span className={`cal-occupancy-count ${
                    (bookingCounts.get(dateStr) ?? 0) > 0 ? 'cal-has-bookings' : ''
                  }`}>
                    {bookingCounts.get(dateStr) ?? 0}
                  </span>
                </div>
              ))}
            </div>

            {/* Room rows */}
            {rooms.map((room) => (
              <CalendarRoomRow
                key={room.id}
                room={room}
                bookings={bookings}
                roomBlocks={roomBlocks}
                dates={dates}
                dict={dict}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <LegendItem color="var(--cal-confirmed)" label={dict.calendar.legend_confirmed} />
        <LegendItem color="var(--cal-deposit)" label={dict.calendar.legend_deposit} />
        <LegendItem color="var(--cal-paid)" label={dict.calendar.legend_paid} />
        <LegendItem color="var(--cal-checked-in)" label={dict.calendar.legend_checkedIn} />
        <LegendItem color="var(--cal-inquiry)" label={dict.calendar.legend_inquiry} />
        <LegendItem color="var(--cal-cancelled)" label={dict.calendar.legend_cancelled} />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-3 w-6 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
