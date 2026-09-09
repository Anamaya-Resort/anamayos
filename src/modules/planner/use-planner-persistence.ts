'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type {
  ExperiencePlan,
  PlannerEvent,
  PlannerMode,
  PlannerRetreat,
  PlannerTemplate,
  TemplateEvent,
} from './types';
import {
  eventsForDates,
  fallbackTemplateEvents,
  materializeTemplate,
  templateEventsFromEvents,
} from './template';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface PlanMeta {
  retreatId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

interface Args {
  dict: TranslationKeys;
  events: PlannerEvent[];
  setEvents: React.Dispatch<React.SetStateAction<PlannerEvent[]>>;
  visibleDates: string[];
  setAnchor: (date: string) => void;
}

/**
 * Owns everything about WHAT the planner is editing (a template vs a retreat
 * plan) and its persistence. The grid still owns the dated `events` array and
 * all drag/edit handlers; this hook loads sets into it and saves them back.
 *
 * Template mode: the loaded template's daily items are materialised onto every
 * visible date (and back-filled as the user navigates weeks). Plan mode: the
 * retreat's dated events are shown as-is, no back-fill.
 */
export function usePlannerPersistence({ dict, events, setEvents, visibleDates, setAnchor }: Args) {
  const [mode, setMode] = useState<PlannerMode>('template');
  const [template, setTemplate] = useState<PlannerTemplate | null>(null);
  const [plan, setPlan] = useState<PlanMeta | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [ready, setReady] = useState(false);

  const [templates, setTemplates] = useState<PlannerTemplate[]>([]);
  const [retreats, setRetreats] = useState<PlannerRetreat[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

  // Current template's date-agnostic items, used for template-mode back-fill.
  const templateEventsRef = useRef<TemplateEvent[]>([]);
  const seededRef = useRef<Set<string>>(new Set());
  const modeRef = useRef<PlannerMode>('template');
  const visibleRef = useRef<string[]>(visibleDates);
  visibleRef.current = visibleDates;
  modeRef.current = mode;

  const markSaved = useCallback(() => {
    setSaveState('saved');
    window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
  }, []);

  // Adopt a template into template mode: replace events across current view.
  const adoptTemplate = useCallback(
    (tpl: PlannerTemplate) => {
      templateEventsRef.current = tpl.events;
      const dates = visibleRef.current;
      seededRef.current = new Set(dates);
      setTemplate(tpl);
      setPlan(null);
      setMode('template');
      setEvents(eventsForDates(tpl.events, dates));
    },
    [setEvents],
  );

  // --- Initial load: standard template, or local fallback -----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/planner/templates');
        if (res.ok) {
          const { templates: list } = (await res.json()) as { templates: PlannerTemplate[] };
          if (!cancelled && Array.isArray(list)) {
            setTemplates(list);
            const std = list.find((x) => x.is_standard) ?? list[0];
            if (std) {
              adoptTemplate(std);
              setReady(true);
              return;
            }
          }
        }
      } catch {
        // fall through to local fallback
      }
      if (cancelled) return;
      const fb = fallbackTemplateEvents(dict);
      templateEventsRef.current = fb;
      seededRef.current = new Set(visibleRef.current);
      setTemplate({ id: '', name: t(dict, 'experience.planner.standardDayName'), description: null, events: fb, is_standard: true });
      setEvents(eventsForDates(fb, visibleRef.current));
      setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Back-fill newly visible dates in template mode (called from the grid). */
  const seedMissingDates = useCallback(
    (dates: string[]) => {
      if (!ready || modeRef.current !== 'template') return;
      const missing = dates.filter((d) => !seededRef.current.has(d));
      if (missing.length === 0) return;
      missing.forEach((d) => seededRef.current.add(d));
      setEvents((prev) => [...prev, ...eventsForDates(templateEventsRef.current, missing)]);
    },
    [ready, setEvents],
  );

  /** Load lists for the OPEN picker. */
  const refreshLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const [tRes, rRes] = await Promise.all([
        fetch('/api/planner/templates'),
        fetch('/api/planner/retreats'),
      ]);
      if (tRes.ok) setTemplates((await tRes.json()).templates ?? []);
      if (rRes.ok) setRetreats((await rRes.json()).retreats ?? []);
    } catch {
      // leave whatever we had
    } finally {
      setListsLoading(false);
    }
  }, []);

  const loadTemplate = useCallback((tpl: PlannerTemplate) => adoptTemplate(tpl), [adoptTemplate]);

  /** Load (or seed) a retreat's experience plan into plan mode. */
  const loadRetreatPlan = useCallback(
    async (retreat: PlannerRetreat) => {
      setSaveState('idle');
      let planRow: ExperiencePlan | null = null;
      try {
        const res = await fetch(`/api/planner/plan?retreatId=${encodeURIComponent(retreat.id)}`);
        if (res.ok) planRow = (await res.json()).plan ?? null;
      } catch { /* offline: seed locally */ }

      let planEvents: PlannerEvent[];
      let status = 'draft';
      if (planRow) {
        planEvents = planRow.events ?? [];
        status = planRow.status ?? 'draft';
      } else {
        // No plan yet: materialise the standard template across the retreat.
        const stdEvents = templateEventsRef.current.length
          ? templateEventsRef.current
          : fallbackTemplateEvents(dict);
        planEvents = materializeTemplate(stdEvents, retreat.start_date, retreat.end_date);
        const stdId = templates.find((x) => x.is_standard)?.id;
        try {
          const res = await fetch('/api/planner/plan', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ retreatId: retreat.id, name: retreat.name, events: planEvents, status: 'draft', sourceTemplateId: stdId ?? null }),
          });
          if (res.ok) status = (await res.json()).plan?.status ?? 'draft';
        } catch { /* keep local seed */ }
      }

      seededRef.current = new Set(planEvents.map((e) => e.date));
      setTemplate(null);
      setMode('plan');
      setPlan({ retreatId: retreat.id, name: retreat.name, startDate: retreat.start_date, endDate: retreat.end_date, status });
      setEvents(planEvents);
      if (retreat.start_date) setAnchor(retreat.start_date);
    },
    [dict, templates, setEvents, setAnchor],
  );

  /** Create a template from the currently-loaded events, then edit it. */
  const createTemplate = useCallback(
    async (name: string, description?: string) => {
      const tplEvents = templateEventsFromEvents(events);
      setSaveState('saving');
      try {
        const res = await fetch('/api/planner/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, events: tplEvents }),
        });
        if (!res.ok) { setSaveState('error'); return false; }
        const { template: created } = (await res.json()) as { template: PlannerTemplate };
        setTemplates((prev) => [created, ...prev]);
        adoptTemplate(created);
        markSaved();
        return true;
      } catch {
        setSaveState('error');
        return false;
      }
    },
    [events, adoptTemplate, markSaved],
  );

  /** Build a new template from a (past) retreat's plan, then edit it. */
  const useRetreatAsTemplate = useCallback(
    async (retreat: PlannerRetreat) => {
      try {
        const res = await fetch(`/api/planner/plan?retreatId=${encodeURIComponent(retreat.id)}`);
        const planRow: ExperiencePlan | null = res.ok ? (await res.json()).plan ?? null : null;
        const tplEvents = templateEventsFromEvents(planRow?.events ?? []);
        const created = await fetch('/api/planner/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: retreat.name, events: tplEvents }),
        });
        if (!created.ok) { setSaveState('error'); return false; }
        const { template: tpl } = (await created.json()) as { template: PlannerTemplate };
        setTemplates((prev) => [tpl, ...prev]);
        adoptTemplate(tpl);
        markSaved();
        return true;
      } catch {
        setSaveState('error');
        return false;
      }
    },
    [adoptTemplate, markSaved],
  );

  /** Save the current events to whatever is loaded. */
  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      if (mode === 'template') {
        const tplEvents = templateEventsFromEvents(events);
        templateEventsRef.current = tplEvents;
        if (template?.id) {
          const res = await fetch(`/api/planner/templates/${template.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: tplEvents }),
          });
          if (!res.ok) { setSaveState('error'); return false; }
          const { template: updated } = (await res.json()) as { template: PlannerTemplate };
          setTemplate(updated);
          setTemplates((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        } else {
          // No persisted template id (offline fallback): create one.
          const res = await fetch('/api/planner/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: template?.name || t(dict, 'experience.planner.standardDayName'), events: tplEvents }),
          });
          if (!res.ok) { setSaveState('error'); return false; }
          const { template: created } = (await res.json()) as { template: PlannerTemplate };
          setTemplate(created);
          setTemplates((prev) => [created, ...prev]);
        }
      } else if (plan) {
        const res = await fetch('/api/planner/plan', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ retreatId: plan.retreatId, name: plan.name, events, status: plan.status }),
        });
        if (!res.ok) { setSaveState('error'); return false; }
      }
      markSaved();
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [mode, events, template, plan, dict, markSaved]);

  return {
    mode, template, plan, saveState, ready,
    templates, retreats, listsLoading,
    refreshLists, loadTemplate, loadRetreatPlan, createTemplate, useRetreatAsTemplate, save,
    seedMissingDates,
  };
}
