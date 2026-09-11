'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';

/** Duration nudges offered by the TIME submenu, in minutes. */
const NUDGES = [-60, -45, -30, -15, 15, 30, 45, 60] as const;

interface EventContextMenuProps {
  dict: TranslationKeys;
  /** Viewport coords the menu anchors to (where the user right-clicked). */
  x: number;
  y: number;
  onEdit: () => void;
  onNudge: (deltaMin: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Self-contained right-click card menu: EDIT, TIME (duration submenu),
 * DELETE, CANCEL. Portaled to <body> at the cursor with its own backdrop
 * for outside-click dismissal, so it does NOT depend on a menu library's
 * open/dismiss lifecycle (base-ui's dropdown closed itself instantly when
 * opened from a right-click). Stays open until the user picks an item,
 * clicks/right-clicks outside, or presses Escape.
 */
export function EventContextMenu({
  dict,
  x,
  y,
  onEdit,
  onNudge,
  onDelete,
  onClose,
}: EventContextMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  // Keep the menu (and its submenu flyout) inside the viewport.
  const MENU_W = 180;
  const MENU_H = 180;
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8));
  const submenuOnLeft = left > window.innerWidth / 2;

  const item =
    'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm ' +
    'cursor-pointer select-none text-left hover:bg-accent hover:text-accent-foreground';

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60]"
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[61] min-w-[160px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        style={{ left, top }}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button type="button" className={item} onClick={onEdit}>
          {t(dict, 'experience.planner.menuEdit')}
        </button>

        <div
          className="relative"
          onMouseEnter={() => setTimeOpen(true)}
          onMouseLeave={() => setTimeOpen(false)}
        >
          <button
            type="button"
            className={item}
            onClick={() => setTimeOpen((v) => !v)}
          >
            <span>{t(dict, 'experience.planner.menuTime')}</span>
            <span aria-hidden className="pl-2 text-muted-foreground">
              {submenuOnLeft ? '‹' : '›'}
            </span>
          </button>
          {timeOpen && (
            <div
              className={
                'absolute top-0 min-w-[112px] rounded-md border border-border bg-popover p-1 shadow-md ' +
                (submenuOnLeft ? 'right-full mr-1' : 'left-full ml-1')
              }
            >
              {NUDGES.map((delta) => (
                <button
                  key={delta}
                  type="button"
                  className={item}
                  onClick={() => onNudge(delta)}
                >
                  <span>
                    {delta > 0 ? `+${delta}` : `${delta}`}{' '}
                    {t(dict, 'experience.planner.minutes')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={item + ' text-destructive hover:bg-destructive/10 hover:text-destructive'}
          onClick={onDelete}
        >
          {t(dict, 'experience.planner.menuDelete')}
        </button>

        <div className="my-1 h-px bg-border" />

        <button type="button" className={item} onClick={onClose}>
          {t(dict, 'experience.planner.menuCancel')}
        </button>
      </div>
    </>,
    document.body,
  );
}
