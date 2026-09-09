'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent } from './types';
import { DAY_MINUTES, ROW_MIN } from './utils';
import { minuteToClock } from './format';

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

function durationLabel(dict: TranslationKeys, min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hLabel = t(dict, 'experience.planner.hours');
  const mLabel = t(dict, 'experience.planner.minutes');
  if (h && m) return `${h}${hLabel} ${m} ${mLabel}`;
  if (h) return `${h}${hLabel}`;
  return `${m} ${mLabel}`;
}

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranslationKeys;
  event: PlannerEvent | null;
  /** Autosave: every field change merges into the event in state immediately. */
  onChange: (patch: Partial<PlannerEvent>) => void;
  onDelete: () => void;
}

/**
 * Real-time edit modal. There is NO save button — each change autosaves via
 * `onChange`. Keydown is stopped at the dialog boundary so no drag logic or
 * global shortcut can ever intercept typing / Backspace / arrows / select-all.
 */
export function EditEventDialog({
  open,
  onOpenChange,
  dict,
  event,
  onChange,
  onDelete,
}: EditEventDialogProps) {
  const startOptions = Array.from(
    { length: DAY_MINUTES / ROW_MIN },
    (_, i) => i * ROW_MIN,
  );
  const maxDuration = event ? DAY_MINUTES - event.startMin : DAY_MINUTES;
  const durationOptions = Array.from(
    { length: Math.floor(maxDuration / ROW_MIN) },
    (_, i) => (i + 1) * ROW_MIN,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => e.stopPropagation()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{t(dict, 'experience.planner.editBlock')}</DialogTitle>
        </DialogHeader>

        {event && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-title">
                {t(dict, 'experience.planner.fieldTitle')}
              </Label>
              <Input
                id="edit-title"
                value={event.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder={t(dict, 'experience.planner.fieldTitlePlaceholder')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-desc">
                {t(dict, 'experience.planner.fieldDescription')}
              </Label>
              <textarea
                id="edit-desc"
                rows={3}
                value={event.description ?? ''}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder={t(
                  dict,
                  'experience.planner.fieldDescriptionPlaceholder',
                )}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-start">
                  {t(dict, 'experience.planner.fieldStart')}
                </Label>
                <select
                  id="edit-start"
                  className={SELECT_CLASS}
                  value={event.startMin}
                  onChange={(e) => onChange({ startMin: Number(e.target.value) })}
                >
                  {startOptions.map((m) => (
                    <option key={m} value={m}>
                      {minuteToClock(dict, m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-duration">
                  {t(dict, 'experience.planner.fieldDuration')}
                </Label>
                <select
                  id="edit-duration"
                  className={SELECT_CLASS}
                  value={event.durationMin}
                  onChange={(e) =>
                    onChange({ durationMin: Number(e.target.value) })
                  }
                >
                  {durationOptions.map((m) => (
                    <option key={m} value={m}>
                      {durationLabel(dict, m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              {t(dict, 'experience.planner.menuDelete')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
