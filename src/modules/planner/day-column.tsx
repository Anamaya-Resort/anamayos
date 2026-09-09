'use client';

import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent } from './types';
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
  nowMinutesIfToday,
} from './utils';
import { EventCard } from './event-card';

export interface DragPreview {
  event: PlannerEvent;
  date: string;
  startMin: number;
}

/** Card interaction callbacks + drag state, threaded through every view. */
export interface PlannerCardActions {
  /** Id of the card currently being dragged (hidden; shown as ghost). */
  draggingId: string | null;
  dragPreview: DragPreview | null;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, date: string, startMin: number) => void;
  onDragCommit: () => void;
  onEdit: (ev: PlannerEvent) => void;
  onNudge: (id: string, deltaMin: number) => void;
  onDelete: (id: string) => void;
}

interface DayColumnProps extends PlannerCardActions {
  date: string;
  /** All events (program + booking) already filtered to this date. */
  events: PlannerEvent[];
  dict: TranslationKeys;
  onCreateAt: (date: string, startMin: number) => void;
  pxPerMin?: number;
  dimmed?: boolean;
  widthPercent?: number;
}

export function DayColumn({
  date,
  events,
  dict,
  onCreateAt,
  pxPerMin = PX_PER_MIN,
  dimmed = false,
  widthPercent,
  draggingId,
  dragPreview,
  onDragStart,
  onDragMove,
  onDragCommit,
  onEdit,
  onNudge,
  onDelete,
}: DayColumnProps) {
  const nowMin = nowMinutesIfToday(date);
  const GRID_HEIGHT = gridHeight(pxPerMin);
  const ROW_HEIGHT = rowHeight(pxPerMin);

  // Split into layers; the dragged card is hidden (its ghost renders instead).
  const visible = events.filter((e) => e.id !== draggingId);
  const program = visible.filter((e) => e.layer === 'program');
  const bookings = visible.filter((e) => e.layer === 'booking');
  const programLanes = computeLanes(program);
  const bookingLanes = computeLanes(bookings);

  const cardHandlers = {
    onDragStart,
    onDragMove,
    onDragCommit,
    onEdit,
    onNudge,
    onDelete,
  };

  return (
    <div
      data-planner-date={date}
      className={`relative border-l border-border ${
        widthPercent === undefined ? 'min-w-[7.5rem] flex-1' : ''
      } ${dimmed ? 'opacity-55' : ''}`}
      style={{
        height: GRID_HEIGHT,
        ...(widthPercent === undefined ? {} : { flex: `0 0 ${widthPercent}%` }),
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

      {/* Program layer (back) — translucent so bookings above show through */}
      {program.map((ev) => (
        <EventCard
          key={ev.id}
          ev={ev}
          dict={dict}
          pxPerMin={pxPerMin}
          lane={programLanes.get(ev.id) ?? { lane: 0, lanes: 1 }}
          {...cardHandlers}
        />
      ))}

      {/* Booking layer (front) */}
      {bookings.map((ev) => (
        <EventCard
          key={ev.id}
          ev={ev}
          dict={dict}
          pxPerMin={pxPerMin}
          lane={bookingLanes.get(ev.id) ?? { lane: 0, lanes: 1 }}
          {...cardHandlers}
        />
      ))}

      {/* Live drag ghost */}
      {dragPreview && dragPreview.date === date && (
        <EventCard
          ghost
          ev={{ ...dragPreview.event, startMin: dragPreview.startMin, date }}
          dict={dict}
          pxPerMin={pxPerMin}
          lane={{ lane: 0, lanes: 1 }}
          {...cardHandlers}
        />
      )}

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
