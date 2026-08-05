'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RefreshCw, Trash2, Loader2, FolderOpen, AlertTriangle } from 'lucide-react';
import type { DriveSource, SourceProgress } from '@/modules/video/sources/queries';
import type { TranslationKeys } from '@/i18n/en';
import { formatDate } from '@/lib/format-date';
import type { Locale } from '@/config/app';

type Props = {
  sources: DriveSource[];
  counts: Record<string, number>;
  progress: Record<string, SourceProgress>;
  dict: TranslationKeys;
  locale: Locale;
};

const STATUS_TONE: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground',
  pending: 'bg-info/15 text-info',
  scanning: 'bg-info/15 text-info',
  error: 'bg-destructive/15 text-destructive',
  paused: 'bg-warning/15 text-warning',
};

export function SourcesPanel({ sources, counts, progress, dict, locale }: Props) {
  const router = useRouter();
  const t = dict.video.sources;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DriveSource | null>(null);

  // Scanning and tagging happen in the background, so the page has to
  // come to the user rather than the other way round. Poll only while
  // something is genuinely in flight.
  const busy = sources.some(
    (s) => s.scan_status === 'pending' || s.scan_status === 'scanning',
  );
  const incomplete = sources.some((s) => {
    const p = progress[s.id];
    return p && p.tagged < p.total;
  });
  useEffect(() => {
    if (!busy && !incomplete) return;
    const iv = setInterval(() => router.refresh(), busy ? 5000 : 15000);
    return () => clearInterval(iv);
  }, [busy, incomplete, router]);

  const act = useCallback(
    async (url: string, method: string, id: string) => {
      setPending(id);
      setError(null);
      try {
        const res = await fetch(url, { method });
        // Silent failure was the old behaviour: a 500 here looked
        // identical to success, so a broken rescan simply did nothing
        // and never said so.
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `${t.actionFailed} (${res.status})`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(null);
      }
    },
    [router, t.actionFailed],
  );

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
          <FolderOpen className="mb-2 h-6 w-6" />
          {t.empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">{t.title}</h2>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {sources.map((s) => {
        const p = progress[s.id];
        const total = p?.total ?? counts[s.id] ?? 0;
        const pct = p && p.total > 0 ? Math.round((p.tagged / p.total) * 100) : 0;
        const isScanning = s.scan_status === 'scanning';

        return (
          <Card key={s.id}>
            <CardContent className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.scan_status === 'pending'
                      ? t.queued
                      : isScanning
                        ? t.scanningNow
                        : s.last_scan_at
                          ? `${t.lastScan}: ${formatDate(s.last_scan_at, locale)}`
                          : t.neverScanned}
                    {s.scan_error && (
                      <span className="ml-2 text-destructive">{s.scan_error}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {total > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {total.toLocaleString()} {dict.video.inventory.files}
                    </span>
                  )}
                  <Badge className={STATUS_TONE[s.scan_status] ?? ''}>
                    {s.scan_status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={t.rescan}
                    aria-label={t.rescan}
                    // Only a scan actually in progress blocks a rescan.
                    // 'pending' used to block it too, so a folder queued
                    // while the worker was down could never be retried
                    // from the UI at all.
                    disabled={pending === s.id || isScanning}
                    onClick={() => act(`/api/video/sources/${s.id}/scan`, 'POST', s.id)}
                  >
                    {pending === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={t.remove}
                    aria-label={t.remove}
                    disabled={pending === s.id}
                    onClick={() => setConfirmDelete(s)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {p && p.total > 0 && (
                <div className="space-y-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-highlight transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted-foreground">
                    <span>
                      {t.progress
                        .replace('{tagged}', p.tagged.toLocaleString())
                        .replace('{total}', p.total.toLocaleString())}
                    </span>
                    {p.failed > 0 && (
                      <span className="text-destructive">
                        {t.failedCount.replace('{n}', String(p.failed))}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Deleting a source cascades to every asset row scanned from it,
          plus their AI tags and every human approval decision. That was
          a single unguarded icon click with no warning. */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t.deleteTitle}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t.deleteBody
              .replace(
                '{n}',
                (
                  progress[confirmDelete?.id ?? '']?.total ??
                  counts[confirmDelete?.id ?? ''] ??
                  0
                ).toLocaleString(),
              )
              .replace('{label}', confirmDelete?.label ?? '')}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const s = confirmDelete;
                setConfirmDelete(null);
                if (s) void act(`/api/video/sources/${s.id}`, 'DELETE', s.id);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
