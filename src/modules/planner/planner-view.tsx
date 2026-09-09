'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { PlannerEvent, PlannerViewMode } from './types';
import { DEFAULT_SCHEDULE } from './default-schedule';
import { TimeGrid } from './time-grid';
import { MonthView } from './month-view';
import { EventDialog, type DraftBlock } from './event-dialog';
import { rangeLabel } from './format';
import { addDays, addMonths, todayStr, weekDates } from './utils';

interface PlannerViewProps {
  dict: TranslationKeys;
}

export function PlannerView({ dict }: PlannerViewProps) {
  const [view, setView] = useState<PlannerViewMode>('week');
  const [anchor, setAnchor] = useState<string>(todayStr());
  // Created blocks live in client state only for this version.
  // TODO: persist to AnamayOS (booking_line_items / planner table) + wire to folio — Phase next.
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<{ date: string; startMin: number } | null>(
    null,
  );

  function navigate(dir: number) {
    if (view === 'day') setAnchor(addDays(anchor, dir));
    else if (view === 'week') setAnchor(addDays(anchor, dir * 7));
    else setAnchor(addMonths(anchor, dir));
  }

  function openCreate(date: string, startMin: number) {
    setDialogInitial({ date, startMin });
    setDialogOpen(true);
  }

  function handleSave(draft: DraftBlock) {
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEvents((prev) => [...prev, { id, ...draft }]);
  }

  const dates = view === 'week' ? weekDates(anchor) : [anchor];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t(dict, 'experience.planner.title')}
        description={t(dict, 'experience.planner.subtitle')}
        actions={
          <Button size="sm" onClick={() => openCreate(anchor, 9 * 60)}>
            <Plus className="h-4 w-4" />
            {t(dict, 'experience.planner.add')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as PlannerViewMode)}>
          <TabsList>
            <TabsTrigger value="day">{t(dict, 'experience.planner.viewDay')}</TabsTrigger>
            <TabsTrigger value="week">{t(dict, 'experience.planner.viewWeek')}</TabsTrigger>
            <TabsTrigger value="month">{t(dict, 'experience.planner.viewMonth')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" onClick={() => navigate(-1)}
            aria-label={t(dict, 'experience.planner.prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(todayStr())}>
            {t(dict, 'experience.planner.today')}
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => navigate(1)}
            aria-label={t(dict, 'experience.planner.next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-sm font-semibold text-foreground">
          {rangeLabel(dict, view, anchor)}
        </span>
      </div>

      {view === 'month' ? (
        <MonthView
          anchor={anchor}
          events={events}
          dict={dict}
          onDayClick={(date) => {
            setAnchor(date);
            setView('day');
          }}
        />
      ) : (
        <TimeGrid
          dates={dates}
          slots={DEFAULT_SCHEDULE}
          events={events}
          dict={dict}
          onCreateAt={openCreate}
          onEventClick={() => {}}
          showHeader={view === 'week'}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-brand-highlight/25 ring-1 ring-brand-highlight/50" />
          {t(dict, 'experience.planner.type_yoga')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-info/20 ring-1 ring-info/50" />
          {t(dict, 'experience.planner.type_meal')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-brand-btn" />
          {t(dict, 'experience.planner.bookings')}
        </span>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dict={dict}
        initial={dialogInitial}
        onSave={handleSave}
      />
    </div>
  );
}
