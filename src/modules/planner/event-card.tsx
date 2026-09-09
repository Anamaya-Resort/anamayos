'use client';

import { useState } from 'react';
import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent } from './types';
import {
  DAY_MINUTES,
  clampStart,
  eventColor,
  minToPx,
  snapToRow,
  translucent,
} from './utils';
import { minuteToClock } from './format';
import { EventContextMenu } from './event-context-menu';

/** Pixels the pointer must travel before a press becomes a drag (not a click). */
const DRAG_THRESHOLD = 4;

interface EventCardProps {
  ev: PlannerEvent;
  dict: TranslationKeys;
  pxPerMin: number;
  /** Lane placement within this card's layer (side-by-side overlap split). */
  lane: { lane: number; lanes: number };
  onDragStart: (id: string) => void;
  onDragMove: (id: string, date: string, startMin: number) => void;
  onDragCommit: () => void;
  onEdit: (ev: PlannerEvent) => void;
  onNudge: (id: string, deltaMin: number) => void;
  onDelete: (id: string) => void;
  /** Render as a non-interactive drag preview (the live ghost). */
  ghost?: boolean;
}

export function EventCard({
  ev,
  dict,
  pxPerMin,
  lane,
  onDragStart,
  onDragMove,
  onDragCommit,
  onEdit,
  onNudge,
  onDelete,
  ghost = false,
}: EventCardProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const color = eventColor(ev);
  const widthPct = 100 / lane.lanes;
  const z = ev.layer === 'program' ? 10 : 20;

  /**
   * Begin a pointer-drag. Move/up handlers are attached to `window`
   * imperatively (NOT via a React effect) so they survive this card
   * unmounting when the drag hops it to another day column.
   */
  function handlePointerDown(e: React.PointerEvent) {
    if (ghost || e.button !== 0) return; // left-button only; ghost is inert
    const col = (e.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-planner-date]',
    );
    if (!col) return;
    const rect = col.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    // Minutes between the grabbed point and the card's own start.
    const grabOffsetMin = (e.clientY - rect.top) / pxPerMin - ev.startMin;
    let dragging = false;

    const onMove = (me: PointerEvent) => {
      if (
        !dragging &&
        Math.hypot(me.clientX - startX, me.clientY - startY) < DRAG_THRESHOLD
      ) {
        return;
      }
      if (!dragging) {
        dragging = true;
        onDragStart(ev.id);
      }
      const targetCol =
        document
          .elementFromPoint(me.clientX, me.clientY)
          ?.closest<HTMLElement>('[data-planner-date]') ?? col;
      const r = targetCol.getBoundingClientRect();
      const date = targetCol.getAttribute('data-planner-date') ?? ev.date;
      const raw = (me.clientY - r.top) / pxPerMin - grabOffsetMin;
      const startMin = clampStart(snapToRow(raw), ev.durationMin);
      onDragMove(ev.id, date, Math.min(startMin, DAY_MINUTES - ev.durationMin));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragging) onDragCommit();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <>
      <div
        role={ghost ? undefined : 'button'}
        tabIndex={ghost ? undefined : 0}
        onPointerDown={handlePointerDown}
        onDoubleClick={ghost ? undefined : () => onEdit(ev)}
        onContextMenu={
          ghost
            ? undefined
            : (e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY });
              }
        }
        className={`absolute overflow-hidden rounded-[5px] border px-1.5 py-0.5 text-left text-[10px] leading-tight text-foreground shadow-sm ${
          ghost ? 'pointer-events-none opacity-80' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{
          top: minToPx(ev.startMin, pxPerMin),
          height: Math.max(minToPx(ev.durationMin, pxPerMin) - 1, 14),
          left: `calc(${lane.lane * widthPct}% + 2px)`,
          width: `calc(${widthPct}% - 4px)`,
          backgroundColor: translucent(color.bg, 50),
          borderColor: color.border,
          borderLeftWidth: 3,
          zIndex: ghost ? 40 : z,
          touchAction: 'none',
        }}
      >
        <span className="block truncate font-semibold">{ev.title}</span>
        <span className="block truncate text-foreground/70">
          {minuteToClock(dict, ev.startMin)}
        </span>
      </div>

      {menu && (
        <EventContextMenu
          dict={dict}
          x={menu.x}
          y={menu.y}
          onEdit={() => {
            setMenu(null);
            onEdit(ev);
          }}
          onNudge={(delta) => {
            onNudge(ev.id, delta);
            setMenu(null);
          }}
          onDelete={() => {
            setMenu(null);
            onDelete(ev.id);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
