'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { BookingType } from './types';
import { ROW_MIN, ROWS_PER_DAY } from './utils';
import { minuteToClock } from './format';

export interface DraftBlock {
  title: string;
  type: BookingType;
  date: string;
  startMin: number;
  durationMin: number;
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranslationKeys;
  initial: { date: string; startMin: number } | null;
  onSave: (draft: DraftBlock) => void;
}

const TYPES: BookingType[] = ['spa', 'excursion', 'other', 'meal', 'yoga', 'custom'];
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

export function EventDialog({
  open,
  onOpenChange,
  dict,
  initial,
  onSave,
}: EventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(dict, 'experience.planner.newBlock')}</DialogTitle>
        </DialogHeader>
        {open && initial && (
          // Keyed on the clicked slot so each open starts from fresh defaults
          // (no state-sync effect needed).
          <EventForm
            key={`${initial.date}-${initial.startMin}`}
            dict={dict}
            initial={initial}
            onSave={(draft) => {
              onSave(draft);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EventFormProps {
  dict: TranslationKeys;
  initial: { date: string; startMin: number };
  onSave: (draft: DraftBlock) => void;
  onCancel: () => void;
}

function EventForm({ dict, initial, onSave, onCancel }: EventFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<BookingType>('spa');
  const [startMin, setStartMin] = useState(initial.startMin);
  const [durationMin, setDurationMin] = useState(60);

  const startOptions = Array.from({ length: ROWS_PER_DAY }, (_, i) => i * ROW_MIN);
  const durationOptions = Array.from({ length: 32 }, (_, i) => (i + 1) * ROW_MIN);

  function handleSave() {
    const trimmed = title.trim();
    onSave({
      title: trimmed || t(dict, `experience.planner.type_${type}`),
      type,
      date: initial.date,
      startMin,
      durationMin,
    });
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="planner-title">
            {t(dict, 'experience.planner.fieldTitle')}
          </Label>
          <Input
            id="planner-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(dict, 'experience.planner.fieldTitlePlaceholder')}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="planner-type">
            {t(dict, 'experience.planner.fieldType')}
          </Label>
          <select
            id="planner-type"
            className={SELECT_CLASS}
            value={type}
            onChange={(e) => setType(e.target.value as BookingType)}
          >
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(dict, `experience.planner.type_${ty}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="planner-start">
              {t(dict, 'experience.planner.fieldStart')}
            </Label>
            <select
              id="planner-start"
              className={SELECT_CLASS}
              value={startMin}
              onChange={(e) => setStartMin(Number(e.target.value))}
            >
              {startOptions.map((m) => (
                <option key={m} value={m}>
                  {minuteToClock(dict, m)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="planner-duration">
              {t(dict, 'experience.planner.fieldDuration')}
            </Label>
            <select
              id="planner-duration"
              className={SELECT_CLASS}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            >
              {durationOptions.map((m) => (
                <option key={m} value={m}>
                  {durationLabel(dict, m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t(dict, 'experience.planner.cancel')}
        </Button>
        <Button onClick={handleSave}>{t(dict, 'experience.planner.save')}</Button>
      </DialogFooter>
    </>
  );
}
