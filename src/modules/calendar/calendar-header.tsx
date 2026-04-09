'use client';

import type { CalendarConfig } from './types';

interface CalendarHeaderProps {
  config: CalendarConfig;
  dates: string[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function CalendarHeader({ dates }: CalendarHeaderProps) {
  return (
    <div className="cal-header-row">
      {/* Room label column */}
      <div className="cal-room-label-cell cal-header-cell">
        <span className="text-xs text-muted-foreground">Room</span>
      </div>

      {/* Date columns */}
      {dates.map((dateStr) => {
        const d = new Date(dateStr + 'T12:00:00');
        const dayName = DAY_NAMES[d.getDay()];
        const monthName = MONTH_NAMES[d.getMonth()];
        const dayNum = d.getDate();
        const isSaturday = d.getDay() === 6;
        const isSunday = d.getDay() === 0;
        const isFirstOfMonth = dayNum === 1;

        return (
          <div
            key={dateStr}
            className={`cal-date-cell cal-header-cell ${
              isSaturday ? 'cal-saturday' : ''
            } ${isSunday ? 'cal-sunday' : ''} ${
              isFirstOfMonth ? 'cal-month-start' : ''
            }`}
          >
            <span className="cal-day-name">{dayName}</span>
            {(isFirstOfMonth || dayNum <= 1 || dates.indexOf(dateStr) === 0) && (
              <span className="cal-month-name">{monthName}</span>
            )}
            <span className="cal-day-num">{dayNum}</span>
          </div>
        );
      })}
    </div>
  );
}
