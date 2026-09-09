'use client';

import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent, ProgrammingSlot } from './types';
import { DayColumn } from './day-column';
import { PX_PER_MIN, todayStr } from './utils';
import { weekdayAbbr } from './format';
import { TimeAxis } from './time-axis';

interface TimeGridProps {
  dates: string[];
  slots: ProgrammingSlot[];
  events: PlannerEvent[];
  dict: TranslationKeys;
  onCreateAt: (date: string, startMin: number) => void;
  onEventClick: (ev: PlannerEvent) => void;
  /** Show the weekday+date header row (week view). Day view hides it. */
  showHeader?: boolean;
  /** Vertical density (pixels per minute) for the current view. */
  pxPerMin?: number;
}

export function TimeGrid({
  dates,
  slots,
  events,
  dict,
  onCreateAt,
  onEventClick,
  showHeader = true,
  pxPerMin = PX_PER_MIN,
}: TimeGridProps) {
  const today = todayStr();

  return (
    <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-lg border border-border bg-card">
      <div className="min-w-max">
        {/* Header row */}
        {showHeader && (
          <div className="sticky top-0 z-40 flex bg-card/95 backdrop-blur">
            <div className="sticky left-0 z-10 w-14 shrink-0 border-b border-r border-border bg-card" />
            {dates.map((d) => {
              const isToday = d === today;
              return (
                <div
                  key={d}
                  className={`min-w-[7.5rem] flex-1 border-b border-l border-border py-1.5 text-center ${
                    isToday ? 'bg-brand-highlight/10' : ''
                  }`}
                >
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">
                    {weekdayAbbr(dict, d)}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      isToday ? 'text-brand-btn' : 'text-foreground'
                    }`}
                  >
                    {Number(d.slice(-2))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Body row: time axis + day columns */}
        <div className="flex">
          <TimeAxis dict={dict} pxPerMin={pxPerMin} />

          {dates.map((d) => (
            <DayColumn
              key={d}
              date={d}
              slots={slots}
              events={events.filter((e) => e.date === d)}
              dict={dict}
              onCreateAt={onCreateAt}
              onEventClick={onEventClick}
              pxPerMin={pxPerMin}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
