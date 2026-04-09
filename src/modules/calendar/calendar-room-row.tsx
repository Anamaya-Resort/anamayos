'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BOOKING_STATUS_COLORS } from './types';
import type { CalendarRoom, CalendarBooking, CalendarRoomBlock } from './types';

interface CalendarRoomRowProps {
  room: CalendarRoom;
  bookings: CalendarBooking[];
  roomBlocks: CalendarRoomBlock[];
  dates: string[];
  onBookingClick?: (bookingId: string) => void;
}

export function CalendarRoomRow({
  room,
  bookings,
  roomBlocks,
  dates,
  onBookingClick,
}: CalendarRoomRowProps) {
  const [expanded, setExpanded] = useState(true);

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // Filter bookings and blocks for this room within the visible date range
  const visibleBookings = bookings.filter(
    (b) => b.roomId === room.id && b.checkOut > startDate && b.checkIn <= endDate,
  );
  const visibleBlocks = roomBlocks.filter(
    (bl) => bl.roomIds.includes(room.id) && bl.endDate > startDate && bl.startDate <= endDate,
  );

  return (
    <>
      {/* Room label row */}
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
              {room.maxOccupancy} {room.isShared ? 'beds' : 'guests'}
            </span>
            {room.ratePerNight && (
              <span className="cal-room-rate">
                ${room.ratePerNight}
              </span>
            )}
          </div>
        </div>

        {/* Grid cells for this room */}
        <div className="cal-grid-cells">
          {dates.map((dateStr) => {
            const isSaturday = new Date(dateStr + 'T12:00:00').getDay() === 6;
            return (
              <div
                key={dateStr}
                className={`cal-cell ${isSaturday ? 'cal-saturday-cell' : ''}`}
              />
            );
          })}

          {/* Room block overlays */}
          {visibleBlocks.map((block) => {
            const style = getBarStyle(block.startDate, block.endDate, dates);
            if (!style) return null;
            return (
              <div
                key={block.id}
                className="cal-block-bar"
                style={style}
                title={block.name}
              >
                <span className="cal-block-label">{block.name}</span>
              </div>
            );
          })}

          {/* Booking bars (only when expanded) */}
          {expanded &&
            visibleBookings.map((booking, idx) => {
              const style = getBarStyle(booking.checkIn, booking.checkOut, dates);
              if (!style) return null;
              const color =
                BOOKING_STATUS_COLORS[booking.status] ?? 'var(--cal-default)';
              return (
                <div
                  key={booking.id}
                  className="cal-booking-bar"
                  style={{
                    ...style,
                    top: `${28 + idx * 24}px`,
                    backgroundColor: color,
                  }}
                  title={`${booking.guestName} — ${booking.retreatName ?? ''}`}
                  onClick={() => onBookingClick?.(booking.id)}
                >
                  <span className="cal-booking-label">
                    {booking.guestName}
                    {booking.retreatName && (
                      <span className="cal-booking-retreat">
                        {' '}
                        {booking.retreatName}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}

/** Calculate left offset and width for a date range bar */
function getBarStyle(
  startDate: string,
  endDate: string,
  dates: string[],
): React.CSSProperties | null {
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const cellWidth = 'var(--cal-cell-width)';

  // Clamp to visible range
  const barStart = startDate < firstDate ? firstDate : startDate;
  const barEnd = endDate > lastDate ? lastDate : endDate;

  const startIdx = dates.indexOf(barStart);
  const endIdx = dates.indexOf(barEnd);

  if (startIdx === -1 && endIdx === -1) return null;

  const effectiveStart = startIdx >= 0 ? startIdx : 0;
  const effectiveEnd = endIdx >= 0 ? endIdx : dates.length - 1;
  const span = effectiveEnd - effectiveStart + 1;

  if (span <= 0) return null;

  return {
    left: `calc(${effectiveStart} * ${cellWidth})`,
    width: `calc(${span} * ${cellWidth})`,
  };
}
