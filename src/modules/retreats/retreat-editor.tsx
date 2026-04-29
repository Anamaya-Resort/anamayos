'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { BasicsPanel } from './panels/basics-panel';
import { ContentPanel } from './panels/content-panel';
import { ItineraryPanel } from './panels/itinerary-panel';
import { TeachersPanel } from './panels/teachers-panel';
import { PricingPanel } from './panels/pricing-panel';
import { WorkshopsPanel } from './panels/workshops-panel';
import { AddonsPanel } from './panels/addons-panel';
import { FormBuilderPanel } from './panels/form-builder-panel';
import { MediaPanel } from './panels/media-panel';
import { SeoPanel } from './panels/seo-panel';
import { SettingsPanel } from './panels/settings-panel';
import { CollapsiblePanel } from './panels/collapsible-panel';

export interface RetreatData {
  id?: string;
  [key: string]: unknown;
}

interface Props {
  retreatId?: string;
  sessionAccessLevel: number;
  sessionPersonId: string;
}

export function RetreatEditor({ retreatId, sessionAccessLevel, sessionPersonId }: Props) {
  const [retreat, setRetreat] = useState<RetreatData>({});
  const [loading, setLoading] = useState(!!retreatId);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'creating'>('idle');
  const [created, setCreated] = useState(!!retreatId);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const createPromiseRef = useRef<Promise<string | null> | null>(null);

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

  // ── Create retreat (first save) — returns the new ID ──
  const createRetreat = useCallback(async (data: RetreatData): Promise<string | null> => {
    setSaveStatus('creating');
    const res = await fetch('/api/admin/retreats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { setSaveStatus('idle'); return null; }
    const result = await res.json();
    if (result.retreat) {
      setRetreat((prev) => ({ ...prev, ...result.retreat }));
      setCreated(true);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      window.history.replaceState(null, '', `/dashboard/retreats/${result.retreat.id}/edit`);
      return result.retreat.id as string;
    }
    setSaveStatus('idle');
    return null;
  }, []);

  // ── Update retreat (subsequent saves) ──
  const saveRetreat = useCallback(async (data: RetreatData) => {
    if (!data.id) return;
    setSaveStatus('saving');
    const res = await fetch('/api/admin/retreats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } else {
      setSaveStatus('idle');
    }
  }, []);

  // ── Debounced update — auto-creates on first change if name exists ──
  const updateField = useCallback((partial: Record<string, unknown>) => {
    setRetreat((prev) => {
      const next = { ...prev, ...partial };
      if (timerRef.current) clearTimeout(timerRef.current);

      if (next.id) {
        // Already created — debounced save
        timerRef.current = setTimeout(() => saveRetreat(next), 500);
      } else if ((next.name as string)?.trim()) {
        // Not yet created but has a name — auto-create
        if (!createPromiseRef.current) {
          createPromiseRef.current = createRetreat(next).finally(() => { createPromiseRef.current = null; });
        }
      }
      return next;
    });
  }, [saveRetreat, createRetreat]);

  const rid = retreat.id as string | undefined;
  const needsSave = !created;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {/* Header with status */}
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
          {needsSave && (
            <span className="text-xs text-muted-foreground">Enter a name to create the retreat</span>
          )}
        </div>
      </div>

      <CollapsiblePanel title="Basics" defaultOpen>
        <BasicsPanel retreat={retreat} onChange={updateField} />
      </CollapsiblePanel>

      <CollapsiblePanel title="Description & Content">
        <ContentPanel retreat={retreat} onChange={updateField} />
      </CollapsiblePanel>

      <CollapsiblePanel title="Itinerary">
        <ItineraryPanel retreat={retreat} onChange={updateField} />
      </CollapsiblePanel>

      <CollapsiblePanel title="Teachers & Co-Leaders">
        {rid ? (
          <TeachersPanel retreatId={rid} sessionPersonId={sessionPersonId} />
        ) : (
          <PendingHint />
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Pricing">
        {rid ? (
          <PricingPanel retreat={retreat} onChange={updateField} retreatId={rid} />
        ) : (
          <PendingHint />
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Optional Workshops">
        {rid ? (
          <WorkshopsPanel retreatId={rid} />
        ) : (
          <PendingHint />
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Retreat Add-Ons">
        {rid ? (
          <AddonsPanel retreatId={rid} />
        ) : (
          <PendingHint />
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Application Form">
        {rid ? (
          <FormBuilderPanel retreatId={rid} formType="application"
            title="Application Form" description="Require application before booking"
            topMessage="Remember, your guests probably don't like filling in forms, so it's good to keep data collection to the minimum if you can." />
        ) : (
          <PendingHint />
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Intake Form">
        {rid ? (
          <FormBuilderPanel retreatId={rid} formType="intake"
            title="Intake Form" description="Collect intake info after booking"
            topMessage="Remember, your guests probably don't like filling in forms, so it's good to keep data collection to the minimum if you can." />
        ) : (
          <PendingHint />
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Media">
        {rid ? (
          <MediaPanel retreatId={rid} />
        ) : (
          <PendingHint />
        )}
      </CollapsiblePanel>

      {sessionAccessLevel >= 5 && (
        <CollapsiblePanel title="Website & SEO">
          <SeoPanel retreat={retreat} onChange={updateField} />
        </CollapsiblePanel>
      )}

      <CollapsiblePanel title="Settings & Status">
        <SettingsPanel retreat={retreat} onChange={updateField} sessionAccessLevel={sessionAccessLevel} />
      </CollapsiblePanel>
    </div>
  );
}

function PendingHint() {
  return (
    <p className="text-sm text-muted-foreground italic py-2">
      Enter a retreat name above to enable this section.
    </p>
  );
}
