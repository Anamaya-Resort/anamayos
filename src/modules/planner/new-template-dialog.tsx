'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/i18n';
import type { TranslationKeys } from '@/i18n/en';

interface NewTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranslationKeys;
  onCreate: (name: string, description?: string) => Promise<boolean>;
}

/** NEW: save the currently-loaded schedule as a reusable template. */
export function NewTemplateDialog({ open, onOpenChange, dict, onCreate }: NewTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(dict, 'experience.planner.newTplTitle')}</DialogTitle>
          <DialogDescription>{t(dict, 'experience.planner.newTplDesc')}</DialogDescription>
        </DialogHeader>
        {open && <NewTemplateForm dict={dict} onCreate={onCreate} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NewTemplateForm({
  dict,
  onCreate,
  onClose,
}: {
  dict: TranslationKeys;
  onCreate: (name: string, description?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onCreate(trimmed, description.trim() || undefined);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="tpl-name">{t(dict, 'experience.planner.tplNameLabel')}</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(dict, 'experience.planner.tplNamePlaceholder')}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tpl-desc">{t(dict, 'experience.planner.tplDescLabel')}</Label>
          <Input
            id="tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(dict, 'experience.planner.tplDescPlaceholder')}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t(dict, 'experience.planner.cancel')}
        </Button>
        <Button onClick={handleCreate} disabled={!name.trim() || busy}>
          {t(dict, 'experience.planner.createTpl')}
        </Button>
      </DialogFooter>
    </>
  );
}
