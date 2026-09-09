'use client';

import type { TranslationKeys } from '@/i18n/en';
import { gridHeight, minToPx } from './utils';
import { hourLabel } from './format';

interface TimeAxisProps {
  dict: TranslationKeys;
  /** Vertical density (pixels per minute) for the current view. */
  pxPerMin: number;
}

/** Sticky left hour-axis shared by the week and day time grids. */
export function TimeAxis({ dict, pxPerMin }: TimeAxisProps) {
  return (
    <div
      className="sticky left-0 z-30 w-14 shrink-0 border-r border-border bg-card"
      style={{ height: gridHeight(pxPerMin) }}
    >
      <div className="relative h-full">
        {Array.from({ length: 24 }, (_, h) => (
          <span
            key={h}
            className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground"
            style={{ top: minToPx(h * 60, pxPerMin) }}
          >
            {h === 0 ? '' : hourLabel(dict, h)}
          </span>
        ))}
      </div>
    </div>
  );
}
