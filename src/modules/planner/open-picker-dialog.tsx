'use client';

import { useEffect } from 'react';
import { Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { Locale } from '@/config/app';
import { formatDate } from '@/lib/format-date';
import { todayStr } from './utils';
import type { PlannerRetreat, PlannerTemplate } from './types';

interface OpenPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranslationKeys;
  locale: Locale;
  templates: PlannerTemplate[];
  retreats: PlannerRetreat[];
  loading: boolean;
  onRefresh: () => void;
  onPickTemplate: (tpl: PlannerTemplate) => void;
  onPickRetreat: (retreat: PlannerRetreat) => void;
  onUseAsTemplate: (retreat: PlannerRetreat) => void;
}

/** OPEN: two clearly-separated tabs — Templates and Retreat Plans. */
export function OpenPickerDialog(props: OpenPickerDialogProps) {
  const { open, onOpenChange, dict, locale, templates, retreats, loading, onRefresh } = props;

  useEffect(() => {
    if (open) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = todayStr();
  const upcoming = retreats.filter((r) => !(r.end_date && r.end_date < today));
  const past = retreats.filter((r) => r.end_date && r.end_date < today);

  function close() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(dict, 'experience.planner.openTitle')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="templates" orientation="horizontal">
          <TabsList>
            <TabsTrigger value="templates">{t(dict, 'experience.planner.tabTemplates')}</TabsTrigger>
            <TabsTrigger value="plans">{t(dict, 'experience.planner.tabPlans')}</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="max-h-[50vh] overflow-y-auto">
            {loading && templates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t(dict, 'experience.planner.loading')}</p>
            ) : templates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t(dict, 'experience.planner.noTemplates')}</p>
            ) : (
              <ul className="space-y-1">
                {templates.map((tpl) => (
                  <li key={tpl.id || tpl.name}>
                    <button
                      type="button"
                      onClick={() => { props.onPickTemplate(tpl); close(); }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{tpl.name}</span>
                        {tpl.description && (
                          <span className="text-xs text-muted-foreground">{tpl.description}</span>
                        )}
                      </span>
                      {tpl.is_standard && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          <Star className="h-3 w-3" />
                          {t(dict, 'experience.planner.standardBadge')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="plans" className="max-h-[50vh] overflow-y-auto">
            {loading && retreats.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t(dict, 'experience.planner.loading')}</p>
            ) : retreats.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t(dict, 'experience.planner.noRetreats')}</p>
            ) : (
              <div className="space-y-3">
                <RetreatSection
                  label={t(dict, 'experience.planner.upcoming')}
                  retreats={upcoming}
                  dict={dict}
                  locale={locale}
                  onPick={(r) => { props.onPickRetreat(r); close(); }}
                  onUseAsTemplate={(r) => { props.onUseAsTemplate(r); close(); }}
                  showUseAsTemplate={false}
                />
                <RetreatSection
                  label={t(dict, 'experience.planner.past')}
                  retreats={past}
                  dict={dict}
                  locale={locale}
                  onPick={(r) => { props.onPickRetreat(r); close(); }}
                  onUseAsTemplate={(r) => { props.onUseAsTemplate(r); close(); }}
                  showUseAsTemplate
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function RetreatSection({
  label,
  retreats,
  dict,
  locale,
  onPick,
  onUseAsTemplate,
  showUseAsTemplate,
}: {
  label: string;
  retreats: PlannerRetreat[];
  dict: TranslationKeys;
  locale: Locale;
  onPick: (r: PlannerRetreat) => void;
  onUseAsTemplate: (r: PlannerRetreat) => void;
  showUseAsTemplate: boolean;
}) {
  if (retreats.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-1">
        {retreats.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex flex-1 flex-col items-start text-left hover:opacity-80"
            >
              <span className="font-medium text-foreground">{r.name}</span>
              <span className="text-xs text-muted-foreground">
                {r.start_date && r.end_date
                  ? `${formatDate(r.start_date, locale)} - ${formatDate(r.end_date, locale)}`
                  : t(dict, 'experience.planner.noDates')}
                {' · '}
                {r.status}
              </span>
            </button>
            {showUseAsTemplate && (
              <Button variant="outline" size="xs" onClick={() => onUseAsTemplate(r)}>
                {t(dict, 'experience.planner.useAsTemplate')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
