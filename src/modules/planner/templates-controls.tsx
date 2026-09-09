'use client';

import { useState } from 'react';
import { Check, FilePlus2, FolderOpen, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';
import type { Locale } from '@/config/app';
import { NewTemplateDialog } from './new-template-dialog';
import { OpenPickerDialog } from './open-picker-dialog';
import type { usePlannerPersistence } from './use-planner-persistence';

interface TemplatesControlsProps {
  dict: TranslationKeys;
  locale: Locale;
  store: ReturnType<typeof usePlannerPersistence>;
}

/**
 * The "Templates" control group (NEW / OPEN / SAVE) that sits directly below
 * the Add Block button, plus the NEW and OPEN dialogs it drives.
 */
export function TemplatesControls({ dict, locale, store }: TemplatesControlsProps) {
  const [newOpen, setNewOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);

  const saving = store.saveState === 'saving';
  const saved = store.saveState === 'saved';

  return (
    <>
      <div className="flex items-center gap-1.5" aria-label={t(dict, 'experience.planner.templatesLabel')}>
        <span className="mr-0.5 hidden text-xs font-medium text-muted-foreground sm:inline">
          {t(dict, 'experience.planner.templatesLabel')}:
        </span>
        <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
          <FilePlus2 className="h-3.5 w-3.5" />
          {t(dict, 'experience.planner.tplNew')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpenOpen(true)}>
          <FolderOpen className="h-3.5 w-3.5" />
          {t(dict, 'experience.planner.tplOpen')}
        </Button>
        <Button size="sm" onClick={() => store.save()} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saved ? t(dict, 'experience.planner.saved') : t(dict, 'experience.planner.tplSave')}
        </Button>
      </div>

      <NewTemplateDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        dict={dict}
        onCreate={store.createTemplate}
      />

      <OpenPickerDialog
        open={openOpen}
        onOpenChange={setOpenOpen}
        dict={dict}
        locale={locale}
        templates={store.templates}
        retreats={store.retreats}
        loading={store.listsLoading}
        onRefresh={store.refreshLists}
        onPickTemplate={store.loadTemplate}
        onPickRetreat={store.loadRetreatPlan}
        onUseAsTemplate={store.useRetreatAsTemplate}
      />
    </>
  );
}
