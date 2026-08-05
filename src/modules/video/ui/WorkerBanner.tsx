import { AlertTriangle } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';
import type { WorkerStatus } from '@/modules/video/worker-status';

/**
 * Shown wherever the user is waiting on background work. Without it,
 * a dead worker looks exactly like an idle one: a spinner that never
 * resolves and no explanation anywhere in the product.
 */
export function WorkerBanner({
  worker,
  dict,
}: {
  worker: WorkerStatus | null | undefined;
  dict: TranslationKeys;
}) {
  if (!worker || worker.online) return null;
  const t = dict.video.worker;
  const seen = worker.beatAt
    ? new Date(worker.beatAt).toLocaleString()
    : t.never;

  return (
    <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="space-y-0.5">
        <div className="font-medium text-warning-foreground">{t.offlineTitle}</div>
        <p className="text-muted-foreground">{t.offlineBody}</p>
        <p className="text-muted-foreground">
          {t.lastSeen}: {seen}
        </p>
      </div>
    </div>
  );
}
