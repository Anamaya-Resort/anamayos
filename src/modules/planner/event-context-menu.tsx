'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
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
 * Right-click card menu: EDIT, TIME (duration submenu), DELETE, CANCEL.
 * Reuses the app's base-ui dropdown-menu primitive, anchored to an invisible
 * fixed point at the cursor (base-ui has no separate context-menu primitive).
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
  return (
    <DropdownMenu
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal={false}
    >
      <DropdownMenuTrigger
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed h-0 w-0 p-0 opacity-0"
        style={{ left: x, top: y }}
      />
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={2}
        className="w-auto min-w-36"
      >
        <DropdownMenuItem onClick={onEdit}>
          {t(dict, 'experience.planner.menuEdit')}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t(dict, 'experience.planner.menuTime')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {NUDGES.map((delta) => (
              <DropdownMenuItem key={delta} onClick={() => onNudge(delta)}>
                {delta > 0 ? `+${delta}` : `${delta}`}{' '}
                {t(dict, 'experience.planner.minutes')}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          {t(dict, 'experience.planner.menuDelete')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onClose}>
          {t(dict, 'experience.planner.menuCancel')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
