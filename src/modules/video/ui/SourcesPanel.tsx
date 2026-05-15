'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, Loader2, FolderOpen } from 'lucide-react';
import type { DriveSource } from '@/modules/video/sources/queries';
import type { TranslationKeys } from '@/i18n/en';
import { formatDate } from '@/lib/format-date';
import type { Locale } from '@/config/app';

type Props = {
  sources: DriveSource[];
  counts: Record<string, number>;
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

export function SourcesPanel({ sources, counts, dict, locale }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function act(url: string, method: string, id: string) {
    setPending(id);
    try {
      await fetch(url, { method });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
          <FolderOpen className="mb-2 h-6 w-6" />
          {dict.video.sources.empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">{dict.video.sources.title}</h2>
      {sources.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">
                {s.last_scan_at
                  ? `${dict.video.sources.lastScan}: ${formatDate(s.last_scan_at, locale)}`
                  : dict.video.sources.neverScanned}
                {s.scan_error && (
                  <span className="ml-2 text-destructive">{s.scan_error}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {counts[s.id] != null && (
                <span className="text-xs text-muted-foreground">
                  {counts[s.id].toLocaleString()} {dict.video.inventory.files}
                </span>
              )}
              <Badge className={STATUS_TONE[s.scan_status] ?? ''}>
                {s.scan_status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending === s.id || ['pending', 'scanning'].includes(s.scan_status)}
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
                disabled={pending === s.id}
                onClick={() => act(`/api/video/sources/${s.id}`, 'DELETE', s.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
