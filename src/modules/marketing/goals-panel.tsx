'use client';

import { useCallback, useEffect, useState } from 'react';
import { Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarketingGoal, MarketingPlatform } from './types';
import type { TranslationKeys } from '@/i18n/en';

const TEXTAREA =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm ' +
  'transition-colors outline-none placeholder:text-muted-foreground ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

type Draft = {
  title: string;
  platform_key: string;
  period_start: string;
  period_end: string;
  target_spend: string;
  target_leads: string;
  target_bookings: string;
  target_revenue: string;
  target_roas: string;
  body: string;
};

const BLANK: Draft = {
  title: '', platform_key: '', period_start: '', period_end: '',
  target_spend: '', target_leads: '', target_bookings: '', target_revenue: '',
  target_roas: '', body: '',
};

const NUMBER_FIELDS: { key: keyof Draft; labelKey: string }[] = [
  { key: 'target_spend', labelKey: 'spend' },
  { key: 'target_leads', labelKey: 'leads' },
  { key: 'target_bookings', labelKey: 'bookings' },
  { key: 'target_revenue', labelKey: 'revenue' },
  { key: 'target_roas', labelKey: 'roas' },
];

/**
 * Where campaign goals get written. Numeric targets are all optional: a
 * goal that is just a pasted brief still gives 0N1X-2 something to advise
 * against, which is the point of storing them.
 */
export function GoalsButton({
  platforms, dict,
}: {
  platforms: MarketingPlatform[]; dict: TranslationKeys;
}) {
  const d = dict.dash;
  const [goals, setGoals] = useState<MarketingGoal[]>([]);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketing/goals');
      if (!res.ok) return;
      const json = await res.json();
      setGoals(json.goals ?? []);
    } catch {
      // A failed list is not worth an alarm; the form still works.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!draft.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/marketing/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? d.goals.saveFailed);
        return;
      }
      setDraft(BLANK);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/marketing/goals?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof Draft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" aria-label={d.goals.title}>
            <Target className="h-4 w-4" />
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{d.goals.title}</SheetTitle>
        </SheetHeader>
        <p className="px-4 text-xs text-muted-foreground">{d.goals.hint}</p>

        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <Label htmlFor="goal-title" className="text-xs">{d.goals.goalTitle}</Label>
            <Input
              id="goal-title"
              value={draft.title}
              onChange={(e) => set('title')(e.target.value)}
              placeholder={d.goals.titlePlaceholder}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="goal-platform" className="text-xs">{d.goals.platform}</Label>
            <select
              id="goal-platform"
              value={draft.platform_key}
              onChange={(e) => set('platform_key')(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
            >
              <option value="">{d.goals.allPlatforms}</option>
              {platforms.map((p) => (
                <option key={p.key} value={p.key}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="goal-start" className="text-xs">{d.goals.from}</Label>
              <Input id="goal-start" type="date" value={draft.period_start}
                onChange={(e) => set('period_start')(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-end" className="text-xs">{d.goals.to}</Label>
              <Input id="goal-end" type="date" value={draft.period_end}
                onChange={(e) => set('period_end')(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {NUMBER_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`goal-${f.key}`} className="text-xs">
                  {(d.kpi as Record<string, string>)[f.labelKey]}
                </Label>
                <Input
                  id={`goal-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  value={draft[f.key]}
                  onChange={(e) => set(f.key)(e.target.value)}
                  placeholder={d.goals.optional}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="goal-body" className="text-xs">{d.goals.brief}</Label>
            <textarea
              id="goal-body"
              rows={6}
              value={draft.body}
              onChange={(e) => set('body')(e.target.value)}
              placeholder={d.goals.briefPlaceholder}
              className={TEXTAREA}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="button" onClick={save} disabled={busy || !draft.title.trim()} className="w-full">
            {d.goals.add}
          </Button>

          {goals.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <h3 className="font-heading text-xs font-semibold uppercase text-muted-foreground">
                {d.goals.existing}
              </h3>
              {goals.map((g) => (
                <div key={g.id} className="flex items-start justify-between gap-2 rounded-lg border border-border px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{g.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {g.platform_key ?? d.goals.allPlatforms}
                      {g.period_start ? ` · ${g.period_start}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={d.goals.remove}
                    onClick={() => remove(g.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
