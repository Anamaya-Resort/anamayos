'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BasicsPanel } from './panels/basics-panel';
import { ContentPanel } from './panels/content-panel';
import { ItineraryPanel } from './panels/itinerary-panel';
import { TeachersPanel } from './panels/teachers-panel';
import { PricingPanel } from './panels/pricing-panel';
import { FormBuilderPanel } from './panels/form-builder-panel';
import { MediaPanel } from './panels/media-panel';
import { SeoPanel } from './panels/seo-panel';
import { SettingsPanel } from './panels/settings-panel';

export interface RetreatData {
  id?: string;
  [key: string]: unknown;
}

interface Props {
  retreatId?: string; // null = create mode
  sessionAccessLevel: number;
  sessionPersonId: string;
}

export function RetreatEditor({ retreatId, sessionAccessLevel, sessionPersonId }: Props) {
  const router = useRouter();
  const [retreat, setRetreat] = useState<RetreatData>({});
  const [loading, setLoading] = useState(!!retreatId);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'creating'>('idle');
  const [created, setCreated] = useState(!!retreatId);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Load existing retreat ──
  useEffect(() => {
    if (!retreatId) return;
    (async () => {
      const res = await fetch(`/api/admin/retreats/${retreatId}`);
      if (res.ok) {
        const data = await res.json();
        setRetreat({ ...data.retreat, _teachers: data.teachers, _forms: data.forms, _pricing_tiers: data.pricing_tiers, _media: data.media });
      }
      setLoading(false);
    })();
  }, [retreatId]);

  // ── Create retreat (first save) ──
  const createRetreat = useCallback(async (data: RetreatData) => {
    setSaveStatus('creating');
    const res = await fetch('/api/admin/retreats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.retreat) {
      setRetreat((prev) => ({ ...prev, ...result.retreat }));
      setCreated(true);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      // Update URL to edit mode without full reload
      window.history.replaceState(null, '', `/dashboard/retreats/${result.retreat.id}/edit`);
    } else {
      setSaveStatus('idle');
    }
  }, []);

  // ── Update retreat (subsequent saves) ──
  const saveRetreat = useCallback(async (data: RetreatData) => {
    if (!data.id) return;
    setSaveStatus('saving');
    await fetch('/api/admin/retreats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, []);

  // ── Debounced update ──
  const updateField = useCallback((partial: Record<string, unknown>) => {
    setRetreat((prev) => {
      const next = { ...prev, ...partial };
      if (timerRef.current) clearTimeout(timerRef.current);
      if (next.id) {
        // Existing retreat — debounced save
        timerRef.current = setTimeout(() => saveRetreat(next), 500);
      }
      return next;
    });
  }, [saveRetreat]);

  // ── First-time create when name is entered ──
  const handleCreateIfNeeded = useCallback(() => {
    if (created || !retreat.name) return;
    createRetreat(retreat);
  }, [created, retreat, createRetreat]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Floating status */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{retreat.id ? 'Edit Retreat' : 'Create Retreat'}</h2>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'creating' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Creating...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
          {!created && (retreat.name as string) && (
            <button onClick={handleCreateIfNeeded}
              className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Create Retreat
            </button>
          )}
        </div>
      </div>

      {/* Panel 1 — Basics */}
      <BasicsPanel retreat={retreat} onChange={updateField} />

      {/* Remaining panels only shown after retreat is created */}
      {created && (
        <>
          <ContentPanel retreat={retreat} onChange={updateField} />
          <ItineraryPanel retreat={retreat} onChange={updateField} />
          <TeachersPanel retreatId={retreat.id as string} sessionPersonId={sessionPersonId} />
          <PricingPanel retreat={retreat} onChange={updateField} retreatId={retreat.id as string} />
          <FormBuilderPanel retreatId={retreat.id as string} formType="application"
            title="Application Form" description="Require application before booking"
            topMessage="Remember, your guests probably don't like filling in forms, so it's good to keep data collection to the minimum if you can." />
          <FormBuilderPanel retreatId={retreat.id as string} formType="intake"
            title="Intake Form" description="Collect intake info after booking"
            topMessage="Remember, your guests probably don't like filling in forms, so it's good to keep data collection to the minimum if you can." />
          <MediaPanel retreatId={retreat.id as string} />
          {sessionAccessLevel >= 5 && <SeoPanel retreat={retreat} onChange={updateField} />}
          <SettingsPanel retreat={retreat} onChange={updateField} sessionAccessLevel={sessionAccessLevel} />
        </>
      )}
    </div>
  );
}
