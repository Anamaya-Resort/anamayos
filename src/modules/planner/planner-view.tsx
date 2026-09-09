'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { Locale } from '@/config/app';
import type { PlannerEvent, PlannerViewMode } from './types';
import { TimeGrid } from './time-grid';
import { DayView } from './day-view';
import { MonthView } from './month-view';
import { EventDialog, type DraftBlock } from './event-dialog';
import { EditEventDialog } from './edit-event-dialog';
import { ModeBanner } from './mode-banner';
import { TemplatesControls } from './templates-controls';
import { usePlannerPersistence } from './use-planner-persistence';
import type { DragPreview } from './day-column';
import { rangeLabel } from './format';
import {
  addDays,
  addMonths,
  clampDuration,
  clampStart,
  todayStr,
  weekDates,
  WEEK_PX_PER_MIN,
} from './utils';

interface PlannerViewProps {
  dict: TranslationKeys;
  locale?: Locale;
}

export function PlannerView({ dict, locale = 'en' }: PlannerViewProps) {
  const [view, setView] = useState<PlannerViewMode>('week');
  const [anchor, setAnchor] = useState<string>(todayStr());

  // The dated cards shown on the grid. Persistence (which template / retreat
  // plan is loaded, and back-filling program items as you navigate) is owned
  // by usePlannerPersistence below; it seeds this array on load.
  const [events, setEvents] = useState<PlannerEvent[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<{
    date: string;
    startMin: number;
  } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  // Drag: dragRef drives the imperative pointer session (survives re-render);
  // dragState mirrors it to render the live ghost.
  const dragRef = useRef<DragPreview | null>(null);
  const [dragState, setDragState] = useState<DragPreview | null>(null);

  const visibleDates = useMemo(() => {
    if (view === 'day') return [addDays(anchor, -1), anchor, addDays(anchor, 1)];
    if (view === 'week') return weekDates(anchor);
    return [];
  }, [view, anchor]);

  const store = usePlannerPersistence({ dict, events, setEvents, visibleDates, setAnchor });
  const { seedMissingDates } = store;

  // Back-fill program cards for any newly-visited date (template mode only;
  // never resurrects an already-seeded date, so deletions stick).
  useEffect(() => {
    seedMissingDates(visibleDates);
  }, [visibleDates, seedMissingDates]);

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
    setEvents((prev) => [...prev, { id, layer: 'booking', ...draft }]);
  }

  // --- Card actions ---------------------------------------------------------
  function handleDragStart(id: string) {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const preview = { event: ev, date: ev.date, startMin: ev.startMin };
    dragRef.current = preview;
    setDragState(preview);
  }

  function handleDragMove(id: string, date: string, startMin: number) {
    const cur = dragRef.current;
    if (!cur) return;
    const preview = { event: cur.event, date, startMin };
    dragRef.current = preview;
    setDragState(preview);
  }

  function handleDragCommit() {
    const d = dragRef.current;
    dragRef.current = null;
    setDragState(null);
    if (!d) return;
    setEvents((prev) =>
      prev.map((e) =>
        e.id === d.event.id ? { ...e, date: d.date, startMin: d.startMin } : e,
      ),
    );
  }

  function handleNudge(id: string, deltaMin: number) {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, durationMin: clampDuration(e.startMin, e.durationMin + deltaMin) }
          : e,
      ),
    );
  }

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (editId === id) setEditId(null);
  }

  function handleEditChange(patch: Partial<PlannerEvent>) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== editId) return e;
        const merged = { ...e, ...patch };
        merged.durationMin = clampDuration(merged.startMin, merged.durationMin);
        merged.startMin = clampStart(merged.startMin, merged.durationMin);
        return merged;
      }),
    );
  }

  const cardActions = {
    draggingId: dragState ? dragState.event.id : null,
    dragPreview: dragState,
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragCommit: handleDragCommit,
    onEdit: (ev: PlannerEvent) => setEditId(ev.id),
    onNudge: handleNudge,
    onDelete: handleDelete,
  };

  const editEvent = editId ? (events.find((e) => e.id === editId) ?? null) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t(dict, 'experience.planner.title')}
        description={t(dict, 'experience.planner.subtitle')}
        actions={
          <div className="flex flex-col items-end gap-2">
            <Button size="sm" onClick={() => openCreate(anchor, 9 * 60)}>
              <Plus className="h-4 w-4" />
              {t(dict, 'experience.planner.add')}
            </Button>
            <TemplatesControls dict={dict} locale={locale} store={store} />
          </div>
        }
      />

      {/* Always-visible: which template / plan is being edited. */}
      <ModeBanner
        dict={dict}
        locale={locale}
        mode={store.mode}
        template={store.template}
        plan={store.plan}
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
          events={events.filter((e) => e.layer === 'booking')}
          dict={dict}
          onDayClick={(date) => {
            setAnchor(date);
            setView('day');
          }}
        />
      ) : view === 'day' ? (
        <DayView
          anchor={anchor}
          events={events}
          dict={dict}
          onCreateAt={openCreate}
          {...cardActions}
        />
      ) : (
        <TimeGrid
          dates={visibleDates}
          events={events}
          dict={dict}
          onCreateAt={openCreate}
          showHeader
          pxPerMin={WEEK_PX_PER_MIN}
          {...cardActions}
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

      <EditEventDialog
        open={editId !== null}
        onOpenChange={(next) => {
          if (!next) setEditId(null);
        }}
        dict={dict}
        event={editEvent}
        onChange={handleEditChange}
        onDelete={() => {
          if (editId) handleDelete(editId);
        }}
      />
    </div>
  );
}
