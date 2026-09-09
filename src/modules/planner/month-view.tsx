'use client';

import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent } from './types';
import { monthGridDates, monthOf, todayStr, bookingColor } from './utils';
import { minuteToClock } from './format';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface MonthViewProps {
  anchor: string;
  events: PlannerEvent[];
  dict: TranslationKeys;
  onDayClick: (date: string) => void;
}

export function MonthView({ anchor, events, dict, onDayClick }: MonthViewProps) {
  const dates = monthGridDates(anchor);
  const currentMonth = monthOf(anchor);
  const today = todayStr();

  const byDate = new Map<string, PlannerEvent[]>();
  for (const ev of events) {
    if (!byDate.has(ev.date)) byDate.set(ev.date, []);
    byDate.get(ev.date)!.push(ev);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_KEYS.map((k) => (
          <div
            key={k}
            className="px-2 py-1.5 text-center text-[10px] font-medium uppercase text-muted-foreground"
          >
            {t(dict, `calendar.${k}`)}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {dates.map((d) => {
          const inMonth = monthOf(d) === currentMonth;
          const isToday = d === today;
          const dayEvents = (byDate.get(d) ?? []).sort(
            (a, b) => a.startMin - b.startMin,
          );
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDayClick(d)}
              className={`min-h-[6rem] border-b border-l border-border p-1 text-left align-top transition-colors first:border-l-0 hover:bg-muted/40 ${
                inMonth ? '' : 'bg-muted/30 text-muted-foreground'
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                    isToday ? 'bg-brand-btn text-white' : 'text-foreground'
                  } ${inMonth ? '' : 'opacity-60'}`}
                >
                  {Number(d.slice(-2))}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => {
                  const color = bookingColor(ev.type);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] text-white"
                      style={{ backgroundColor: color.bg }}
                    >
                      <span className="shrink-0 opacity-90">
                        {minuteToClock(dict, ev.startMin)}
                      </span>
                      <span className="truncate font-medium">{ev.title}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
