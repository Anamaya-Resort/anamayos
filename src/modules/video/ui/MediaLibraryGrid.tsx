'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search, ImageOff, Loader2, Copy, FileVideo, FileAudio, Play, Sparkles, TriangleAlert } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';
import type { WorkerStatus } from '@/modules/video/worker-status';
import { WorkerBanner } from './WorkerBanner';

type Asset = {
  id: string;
  file_name: string;
  drive_path: string | null;
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  thumb_url: string | null;
  proxy_status: string;
  analysis_status: string;
  duplicate_status: string | null;
  duration_ms: number | null;
  aesthetic_score: number | null;
};

type Status = { total: number; proxied: number; tagged: number; failed: number };
type Resp = {
  total: number;
  offset: number;
  pageSize: number;
  status: Status;
  worker: WorkerStatus;
  assets: Asset[];
};

const FILTERS = [
  { id: 'all', key: 'filterAll' },
  { id: 'recent', key: 'filterRecent' },
  { id: 'tagged', key: 'filterTagged' },
  { id: 'processing', key: 'filterProcessing' },
  { id: 'duplicates', key: 'filterDuplicates' },
  { id: 'failed', key: 'filterFailed' },
] as const;

function fmtDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function humanSize(b: number | null): string {
  if (!b) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let n = b, i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function MediaLibraryGrid({ dict }: { dict: TranslationKeys }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      const nextOffset = reset ? 0 : offset;
      try {
        const res = await fetch(
          `/api/video/library?filter=${filter}&q=${encodeURIComponent(debouncedQ)}&offset=${nextOffset}`,
        );
        const json: Resp = await res.json();
        // A failed load used to return silently, leaving the last good
        // grid on screen as if it were current.
        if (!res.ok) {
          setError(
            (json as unknown as { error?: string }).error ??
              `${dict.video.library.loadFailed} (${res.status})`,
          );
          return;
        }
        setTotal(json.total);
        setStatus(json.status ?? null);
        setWorker(json.worker ?? null);
        setAssets((prev) => (reset ? json.assets : [...prev, ...json.assets]));
        setOffset(nextOffset + json.pageSize);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [filter, debouncedQ, offset, dict.video.library.loadFailed],
  );

  // Reload from scratch when filter/search changes.
  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedQ]);

  // Thumbnails and tags arrive from the background worker minutes
  // after a scan. Without this the grid sat on grey placeholder tiles
  // until someone thought to reload the page by hand.
  const pipelineBusy =
    !!status && (status.proxied < status.total || status.tagged < status.total);
  useEffect(() => {
    if (!pipelineBusy) return;
    const iv = setInterval(() => void load(true), 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineBusy, filter, debouncedQ]);

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.id)}
            >
              {dict.video.library[f.key]}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={dict.video.library.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {worker && !worker.online && (
        <div className="mb-3">
          <WorkerBanner worker={worker} dict={dict} />
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {total.toLocaleString()} {dict.video.library.items}
        </span>
        {status && status.total > 0 && (
          <>
            <span>
              {status.proxied.toLocaleString()} / {status.total.toLocaleString()}{' '}
              {dict.video.library.statusProxied}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-brand-highlight" />
              {status.tagged.toLocaleString()} / {status.total.toLocaleString()}{' '}
              {dict.video.library.statusTagged}
            </span>
            {status.failed > 0 && (
              <button
                className="flex items-center gap-1 text-destructive hover:underline"
                onClick={() => setFilter('failed')}
              >
                <TriangleAlert className="h-3 w-3" />
                {status.failed.toLocaleString()} {dict.video.library.statusFailed}
              </button>
            )}
            {pipelineBusy && <Loader2 className="h-3 w-3 animate-spin" />}
          </>
        )}
      </div>

      {assets.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
          <ImageOff className="mb-2 h-6 w-6" />
          {dict.video.library.empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((a) => (
            <figure key={a.id} className="group overflow-hidden rounded-lg border bg-card">
              <div className="relative aspect-square bg-muted">
                {a.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.thumb_url}
                    alt={a.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {a.mime_type.startsWith('video/') ? (
                      <FileVideo className="h-6 w-6" />
                    ) : a.mime_type.startsWith('audio/') ? (
                      <FileAudio className="h-6 w-6" />
                    ) : a.proxy_status === 'processing' || a.proxy_status === 'pending' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImageOff className="h-6 w-6" />
                    )}
                  </div>
                )}
                {a.duplicate_status && (
                  <Badge className="absolute right-1.5 top-1.5 bg-warning/90 text-warning-foreground">
                    <Copy className="mr-1 h-3 w-3" />
                    {a.duplicate_status}
                  </Badge>
                )}
                {a.mime_type.startsWith('video/') && (
                  <>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-black/45 p-2">
                        <Play className="h-5 w-5 fill-white text-white" />
                      </span>
                    </div>
                    {fmtDuration(a.duration_ms) && (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1 text-[10px] text-white">
                        {fmtDuration(a.duration_ms)}
                      </span>
                    )}
                  </>
                )}
              </div>
              <figcaption className="p-2">
                <div className="truncate text-xs font-medium" title={a.file_name}>
                  {a.file_name}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {a.width && a.height ? `${a.width}×${a.height} · ` : ''}
                    {humanSize(a.size_bytes)}
                  </span>
                  {a.analysis_status === 'done' && a.aesthetic_score != null ? (
                    <span className="ml-auto shrink-0 text-brand-highlight">
                      ★ {a.aesthetic_score.toFixed(1)}
                    </span>
                  ) : a.analysis_status === 'error' ? (
                    <TriangleAlert className="ml-auto h-3 w-3 shrink-0 text-destructive" />
                  ) : (
                    <span
                      className="ml-auto shrink-0 opacity-60"
                      title={dict.video.library.untagged}
                    >
                      ○
                    </span>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {assets.length < total && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => load(false)} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dict.video.library.loadMore}
          </Button>
        </div>
      )}
    </Card>
  );
}
