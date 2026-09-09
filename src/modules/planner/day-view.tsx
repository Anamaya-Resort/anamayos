'use client';

import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent, ProgrammingSlot } from './types';
import { DayColumn } from './day-column';
import { TimeAxis } from './time-axis';
import { DAY_PX_PER_MIN, addDays, todayStr } from './utils';
import { weekdayAbbr } from './format';

interface DayViewProps {
  /** The focused day (full colour, centre column). */
  anchor: string;
  slots: ProgrammingSlot[];
  events: PlannerEvent[];
  dict: TranslationKeys;
  onCreateAt: (date: string, startMin: number) => void;
  onEventClick: (ev: PlannerEvent) => void;
}

/**
 * Focused day view: the day before (de-emphasised, ~30%), TODAY (full, ~40%)
 * and the next day (de-emphasised, ~30%), sharing one left time axis. Rows
 * are 50% taller than the base grid for more activity-text room.
 */
export function DayView({
  anchor,
  slots,
  events,
  dict,
  onCreateAt,
  onEventClick,
}: DayViewProps) {
  const today = todayStr();
  const columns = [
    { date: addDays(anchor, -1), width: 30, dimmed: true },
    { date: anchor, width: 40, dimmed: false },
    { date: addDays(anchor, 1), width: 30, dimmed: true },
  ];

  return (
    <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-lg border border-border bg-card">
      <div className="min-w-max">
        {/* Header row: aligned weekday + date over each column */}
        <div className="sticky top-0 z-40 flex bg-card/95 backdrop-blur">
          <div className="sticky left-0 z-10 w-14 shrink-0 border-b border-r border-border bg-card" />
          {columns.map((col) => {
            const isToday = col.date === today;
            return (
              <div
                key={col.date}
                className={`border-b border-l border-border py-1.5 text-center ${
                  isToday ? 'bg-brand-highlight/10' : ''
                } ${col.dimmed ? 'opacity-55' : ''}`}
                style={{ flex: `0 0 ${col.width}%` }}
              >
                <div className="text-[10px] font-medium uppercase text-muted-foreground">
                  {weekdayAbbr(dict, col.date)}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    isToday ? 'text-brand-btn' : 'text-foreground'
                  }`}
                >
                  {Number(col.date.slice(-2))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Body row: shared time axis + three day columns */}
        <div className="flex">
          <TimeAxis dict={dict} pxPerMin={DAY_PX_PER_MIN} />
          {columns.map((col) => (
            <DayColumn
              key={col.date}
              date={col.date}
              slots={slots}
              events={events.filter((e) => e.date === col.date)}
              dict={dict}
              onCreateAt={onCreateAt}
              onEventClick={onEventClick}
              pxPerMin={DAY_PX_PER_MIN}
              dimmed={col.dimmed}
              widthPercent={col.width}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
