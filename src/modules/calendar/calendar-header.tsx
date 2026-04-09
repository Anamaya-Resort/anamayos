'use client';

import type { TranslationKeys } from '@/i18n/en';

interface CalendarHeaderProps {
  dates: string[];
  dict: TranslationKeys;
}

export function CalendarHeader({ dates, dict }: CalendarHeaderProps) {
  const dayNames = [
    dict.calendar.sun, dict.calendar.mon, dict.calendar.tue, dict.calendar.wed,
    dict.calendar.thu, dict.calendar.fri, dict.calendar.sat,
  ];
  const monthNames = [
    dict.calendar.jan, dict.calendar.feb, dict.calendar.mar, dict.calendar.apr,
    dict.calendar.may, dict.calendar.jun, dict.calendar.jul, dict.calendar.aug,
    dict.calendar.sep, dict.calendar.oct, dict.calendar.nov, dict.calendar.dec,
  ];

  return (
    <div className="cal-header-row">
      <div className="cal-room-label-cell cal-header-cell">
        <span className="text-xs text-muted-foreground">{dict.calendar.room}</span>
      </div>

      {dates.map((dateStr) => {
        const d = new Date(dateStr + 'T12:00:00');
        const dayName = dayNames[d.getDay()];
        const monthName = monthNames[d.getMonth()];
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
