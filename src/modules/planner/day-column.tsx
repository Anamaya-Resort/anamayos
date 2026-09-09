'use client';

import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent, ProgrammingSlot } from './types';
import {
  ROWS_PER_DAY,
  ROW_MIN,
  WORK_START_MIN,
  WORK_END_MIN,
  PX_PER_MIN,
  minToPx,
  gridHeight,
  rowHeight,
  computeLanes,
  bookingColor,
  nowMinutesIfToday,
} from './utils';
import { minuteToClock } from './format';

interface DayColumnProps {
  date: string;
  slots: ProgrammingSlot[];
  events: PlannerEvent[];
  dict: TranslationKeys;
  onCreateAt: (date: string, startMin: number) => void;
  onEventClick: (ev: PlannerEvent) => void;
  /** Vertical density (pixels per minute) for the current view. */
  pxPerMin?: number;
  /** De-emphasise this column (adjacent days in the day view). */
  dimmed?: boolean;
  /** Fixed flex-basis percentage; falls back to equal-width flex-1. */
  widthPercent?: number;
}

export function DayColumn({
  date,
  slots,
  events,
  dict,
  onCreateAt,
  onEventClick,
  pxPerMin = PX_PER_MIN,
  dimmed = false,
  widthPercent,
}: DayColumnProps) {
  const lanes = computeLanes(events);
  const nowMin = nowMinutesIfToday(date);
  const GRID_HEIGHT = gridHeight(pxPerMin);
  const ROW_HEIGHT = rowHeight(pxPerMin);

  return (
    <div
      className={`relative border-l border-border ${
        widthPercent === undefined ? 'min-w-[7.5rem] flex-1' : ''
      } ${dimmed ? 'opacity-55' : ''}`}
      style={{
        height: GRID_HEIGHT,
        ...(widthPercent === undefined
          ? {}
          : { flex: `0 0 ${widthPercent}%` }),
      }}
    >
      {/* Base grid: 15-min clickable cells with hour/quarter rules */}
      <div className="absolute inset-0">
        {Array.from({ length: ROWS_PER_DAY }, (_, i) => {
          const isHour = i % 4 === 0;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${date} ${Math.floor((i * ROW_MIN) / 60)}:${String((i * ROW_MIN) % 60).padStart(2, '0')}`}
              onClick={() => onCreateAt(date, i * ROW_MIN)}
              className={`block w-full border-t ${
                isHour ? 'border-border/50' : 'border-border/15'
              } transition-colors hover:bg-muted/50`}
              style={{ height: ROW_HEIGHT }}
            />
          );
        })}
      </div>

      {/* Darkened out-of-window bands (before 5 AM / after 10 PM) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/[0.06]"
        style={{ height: minToPx(WORK_START_MIN, pxPerMin) }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bg-foreground/[0.06]"
        style={{
          top: minToPx(WORK_END_MIN, pxPerMin),
          height: GRID_HEIGHT - minToPx(WORK_END_MIN, pxPerMin),
        }}
      />

      {/* Programming layer — full-width tinted bands */}
      {slots.map((slot) => {
        const top = minToPx(slot.startMin, pxPerMin);
        const height = minToPx(slot.endMin - slot.startMin, pxPerMin);
        const tint =
          slot.kind === 'yoga'
            ? 'bg-brand-highlight/15 border-brand-highlight/50'
            : 'bg-info/10 border-info/50';
        return (
          <div
            key={slot.id}
            className={`pointer-events-none absolute inset-x-0 border-l-2 ${tint}`}
            style={{ top, height }}
          >
            <span className="px-1.5 text-[10px] font-medium text-foreground/60">
              {t(dict, slot.titleKey)}
            </span>
          </div>
        );
      })}

      {/* Booking layer — solid cards on top, overlap allowed */}
      {events.map((ev) => {
        const lane = lanes.get(ev.id) ?? { lane: 0, lanes: 1 };
        const color = bookingColor(ev.type);
        const widthPct = 100 / lane.lanes;
        return (
          <button
            key={ev.id}
            type="button"
            onClick={() => onEventClick(ev)}
            className="absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[10px] leading-tight text-white shadow-sm"
            style={{
              top: minToPx(ev.startMin, pxPerMin),
              height: Math.max(minToPx(ev.durationMin, pxPerMin) - 1, 14),
              left: `calc(${lane.lane * widthPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              backgroundColor: color.bg,
              borderLeftColor: color.border,
              zIndex: 20,
            }}
          >
            <span className="block truncate font-semibold">{ev.title}</span>
            <span className="block truncate opacity-90">
              {minuteToClock(dict, ev.startMin)}
            </span>
          </button>
        );
      })}

      {/* Now line */}
      {nowMin !== null && (
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{ top: minToPx(nowMin, pxPerMin), zIndex: 30 }}
        >
          <div className="relative h-px bg-destructive">
            <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-destructive" />
          </div>
        </div>
      )}
    </div>
  );
}
