'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BOOKING_STATUS_COLORS } from './types';
import type { CalendarRoom, CalendarBooking, CalendarRoomBlock } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface CalendarRoomRowProps {
  room: CalendarRoom;
  bookings: CalendarBooking[];
  roomBlocks: CalendarRoomBlock[];
  dates: string[];
  dict: TranslationKeys;
  onBookingClick?: (bookingId: string) => void;
}

/**
 * Assign bookings to "bed lanes" so overlapping bookings get different lanes.
 * Returns an array of lanes, each containing non-overlapping bookings.
 */
function assignToLanes(bookings: CalendarBooking[]): CalendarBooking[][] {
  const sorted = [...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const lanes: CalendarBooking[][] = [];

  for (const booking of sorted) {
    let placed = false;
    for (const lane of lanes) {
      const lastInLane = lane[lane.length - 1];
      if (lastInLane.checkOut <= booking.checkIn) {
        lane.push(booking);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([booking]);
    }
  }
  return lanes;
}

/** Get the short guest name (first name or truncated) */
function shortName(name: string): string {
  const parts = name.split(' ');
  if (parts.length > 1) return parts[0];
  return name.length > 12 ? name.slice(0, 10) + '..' : name;
}

export function CalendarRoomRow({
  room,
  bookings,
  roomBlocks,
  dates,
  dict,
  onBookingClick,
}: CalendarRoomRowProps) {
  const [expanded, setExpanded] = useState(false);

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const visibleBookings = bookings.filter(
    (b) => b.roomId === room.id && b.checkOut > startDate && b.checkIn <= endDate,
  );
  const visibleBlocks = roomBlocks.filter(
    (bl) => bl.roomIds.includes(room.id) && bl.endDate > startDate && bl.startDate <= endDate,
  );

  const lanes = assignToLanes(visibleBookings);

  return (
    <div className="cal-room-section">
      {/* Room header — always visible */}
      <div className="cal-room-row">
        <div className="cal-room-label-cell">
          <button
            className="cal-room-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="cal-room-name">{room.name}</span>
          </button>
          <div className="cal-room-meta">
            <span className="cal-room-capacity">
              {room.maxOccupancy} {room.isShared ? dict.calendar.beds : dict.calendar.guests}
            </span>
            {room.ratePerNight && (
              <span className="cal-room-rate">${room.ratePerNight}</span>
            )}
          </div>
        </div>

        {/* Collapsed view — one row with condensed booking info */}
        {!expanded && (
          <div className="cal-grid-cells">
            {dates.map((dateStr) => {
              const isSaturday = new Date(dateStr + 'T12:00:00').getDay() === 6;
              return (
                <div key={dateStr} className={`cal-cell ${isSaturday ? 'cal-saturday-cell' : ''}`} />
              );
            })}

            {/* Block overlays */}
            {visibleBlocks.map((block) => {
              const style = getBarStyle(block.startDate, block.endDate, dates);
              if (!style) return null;
              return (
                <div key={block.id} className="cal-block-bar" style={style} title={block.name}>
                  <span className="cal-block-label">{block.name}</span>
                </div>
              );
            })}

            {/* Condensed booking bar — shows all guests in one bar per date range */}
            {visibleBookings.length > 0 && (
              <CollapsedBookings
                bookings={visibleBookings}
                dates={dates}
                onBookingClick={onBookingClick}
              />
            )}
          </div>
        )}

        {/* Expanded placeholder for header row (no bars here) */}
        {expanded && (
          <div className="cal-grid-cells">
            {dates.map((dateStr) => {
              const isSaturday = new Date(dateStr + 'T12:00:00').getDay() === 6;
              return (
                <div key={dateStr} className={`cal-cell ${isSaturday ? 'cal-saturday-cell' : ''}`} />
              );
            })}
            {visibleBlocks.map((block) => {
              const style = getBarStyle(block.startDate, block.endDate, dates);
              if (!style) return null;
              return (
                <div key={block.id} className="cal-block-bar" style={style} title={block.name}>
                  <span className="cal-block-label">{block.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded view — one row per bed lane */}
      {expanded && lanes.map((lane, laneIdx) => (
        <div key={laneIdx} className="cal-bed-row">
          <div className="cal-room-label-cell cal-bed-label">
            <span className="cal-bed-name">B{laneIdx + 1}</span>
          </div>
          <div className="cal-grid-cells">
            {dates.map((dateStr) => {
              const isSaturday = new Date(dateStr + 'T12:00:00').getDay() === 6;
              return (
                <div key={dateStr} className={`cal-cell ${isSaturday ? 'cal-saturday-cell' : ''}`} />
              );
            })}
            {lane.map((booking) => {
              const style = getBarStyle(booking.checkIn, booking.checkOut, dates);
              if (!style) return null;
              const color = BOOKING_STATUS_COLORS[booking.status] ?? 'var(--cal-default)';
              return (
                <div
                  key={booking.id}
                  className="cal-booking-bar cal-booking-bar-bed"
                  style={{ ...style, backgroundColor: color }}
                  title={`${booking.guestName} — ${booking.retreatName ?? ''}`}
                  onClick={() => onBookingClick?.(booking.id)}
                >
                  <span className="cal-booking-label">
                    {booking.guestName}
                    {booking.retreatName && (
                      <span className="cal-booking-retreat"> {booking.retreatName}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Show empty bed lanes if expanded and room has more capacity than bookings */}
      {expanded && Array.from({ length: Math.max(0, room.maxOccupancy - lanes.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="cal-bed-row">
          <div className="cal-room-label-cell cal-bed-label">
            <span className="cal-bed-name cal-bed-empty">B{lanes.length + i + 1}</span>
          </div>
          <div className="cal-grid-cells">
            {dates.map((dateStr) => {
              const isSaturday = new Date(dateStr + 'T12:00:00').getDay() === 6;
              return (
                <div key={dateStr} className={`cal-cell ${isSaturday ? 'cal-saturday-cell' : ''}`} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Collapsed view: one bar per booking, but stacked compactly with bed labels.
 * Two lines of text fit in the bar: "B1: Name  B2: Name"
 */
function CollapsedBookings({
  bookings,
  dates,
  onBookingClick,
}: {
  bookings: CalendarBooking[];
  dates: string[];
  onBookingClick?: (bookingId: string) => void;
}) {
  // Group bookings by their date range (same check-in/check-out)
  const groups = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const key = `${b.checkIn}|${b.checkOut}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  return (
    <>
      {[...groups.entries()].map(([key, group]) => {
        const style = getBarStyle(group[0].checkIn, group[0].checkOut, dates);
        if (!style) return null;
        const color = BOOKING_STATUS_COLORS[group[0].status] ?? 'var(--cal-default)';

        // Build condensed label: "B1: Jane  B2: Bob  B3: —"
        const label = group
          .map((b, i) => `B${i + 1}: ${shortName(b.guestName)}`)
          .join('  ');

        return (
          <div
            key={key}
            className="cal-booking-bar cal-booking-bar-collapsed"
            style={{ ...style, backgroundColor: color }}
            title={group.map((b) => b.guestName).join(', ')}
            onClick={() => group.length === 1 && onBookingClick?.(group[0].id)}
          >
            <span className="cal-booking-label cal-booking-label-collapsed">
              {label}
            </span>
          </div>
        );
      })}
    </>
  );
}

/**
 * Calculate left offset and width for a date range bar.
 * Start day begins at 50% (afternoon arrival).
 * End day ends at 50% (morning departure).
 * If clipped at visible range edge, no half-day offset on that side.
 */
function getBarStyle(
  startDate: string,
  endDate: string,
  dates: string[],
): React.CSSProperties | null {
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const cellWidth = 'var(--cal-cell-width)';

  const barStart = startDate < firstDate ? firstDate : startDate;
  const barEnd = endDate > lastDate ? lastDate : endDate;

  const startIdx = dates.indexOf(barStart);
  const endIdx = dates.indexOf(barEnd);

  if (startIdx === -1 && endIdx === -1) return null;

  const effectiveStart = startIdx >= 0 ? startIdx : 0;
  const effectiveEnd = endIdx >= 0 ? endIdx : dates.length - 1;
  const span = effectiveEnd - effectiveStart + 1;

  if (span <= 0) return null;

  const startClipped = startDate < firstDate;
  const endClipped = endDate > lastDate;

  const leftOffset = startClipped ? 0 : 0.5;
  const rightOffset = endClipped ? 0 : 0.5;

  return {
    left: `calc((${effectiveStart} + ${leftOffset}) * ${cellWidth})`,
    width: `calc((${span} - ${leftOffset} - ${rightOffset}) * ${cellWidth})`,
  };
}
