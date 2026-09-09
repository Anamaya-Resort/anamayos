'use client';

import { CalendarDays, LayoutTemplate } from 'lucide-react';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { Locale } from '@/config/app';
import { formatDate } from '@/lib/format-date';
import type { PlannerMode, PlannerTemplate } from './types';
import type { PlanMeta } from './use-planner-persistence';

interface ModeBannerProps {
  dict: TranslationKeys;
  locale: Locale;
  mode: PlannerMode;
  template: PlannerTemplate | null;
  plan: PlanMeta | null;
}

/**
 * Always-visible chip that makes it unmistakable whether the planner is
 * editing a reusable TEMPLATE (neutral chip) or a specific retreat's
 * EXPERIENCE PLAN (brand-accent chip, with its draft/approved status).
 */
export function ModeBanner({ dict, locale, mode, template, plan }: ModeBannerProps) {
  if (mode === 'template') {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm">
        <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">
          {t(dict, 'experience.planner.modeTemplate')}:
        </span>
        <span className="font-semibold text-foreground">
          {template?.name ?? t(dict, 'experience.planner.standardDayName')}
        </span>
      </div>
    );
  }

  const dates =
    plan?.startDate && plan?.endDate
      ? ` (${formatDate(plan.startDate, locale)} - ${formatDate(plan.endDate, locale)})`
      : '';
  const statusKey =
    plan?.status === 'approved'
      ? 'experience.planner.statusApproved'
      : 'experience.planner.statusDraft';

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-brand-highlight/50 bg-brand-highlight/15 px-3 py-1.5 text-sm">
      <CalendarDays className="h-4 w-4 text-brand-highlight" />
      <span className="font-medium text-foreground/70">
        {t(dict, 'experience.planner.modePlan')} -
      </span>
      <span className="font-semibold text-foreground">
        {plan?.name}
        {dates}
      </span>
      <span className="ml-1 rounded-full bg-brand-highlight/25 px-2 py-0.5 text-xs font-medium text-foreground">
        {t(dict, statusKey)}
      </span>
    </div>
  );
}
