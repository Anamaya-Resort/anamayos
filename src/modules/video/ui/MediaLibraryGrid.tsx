'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search, ImageOff, Loader2, Copy, FileVideo, FileAudio, Play, Sparkles, TriangleAlert, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslationKeys } from '@/i18n/en';
import type { WorkerStatus } from '@/modules/video/worker-status';
import { WorkerBanner } from './WorkerBanner';
import AnamayaLightbox from '@/components/shared/anamaya-lightbox';
import { UpscaleMenu } from './UpscaleMenu';

type Asset = {
  id: string;
  file_name: string;
  drive_path: string | null;
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  thumb_url: string | null;
  proxy_url: string | null;
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

/** Tile counts across the row. The wide end is for scanning thousands. */
const COLUMN_CHOICES = [3, 4, 5, 8, 12, 20] as const;
const COLS_KEY = 'video.library.columns';
/** Matches PAGE in the library route; used to tell page 1 from the rest. */
const PAGE_SIZE = 60;
/** Past this density a filename is unreadable, so the caption is dropped. */
const CAPTION_MAX_COLS = 8;

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
  const [cols, setCols] = useState(5);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Remember the density per browser. Reading localStorage can throw in
  // a locked-down browser, so never let it break the grid.
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(COLS_KEY));
      if (COLUMN_CHOICES.includes(saved as (typeof COLUMN_CHOICES)[number])) {
        setCols(saved);
      }
    } catch {
      /* default of 5 stands */
    }
  }, []);

  // Twenty tiles across a phone is not a view of anything, so the
  // chosen density only applies once there is room for it. Watched
  // rather than measured once, so rotating the device is handled.
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const effectiveCols = wide ? cols : Math.min(cols, 2);

  const chooseCols = useCallback((n: number) => {
    setCols(n);
    try {
      window.localStorage.setItem(COLS_KEY, String(n));
    } catch {
      /* not worth surfacing */
    }
  }, []);

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
  // after a scan, so the grid refreshes itself while work is in flight.
  //
  // It must NOT do that by reloading from scratch: load(true) resets to
  // the first page, so anything reached via Load More vanished a few
  // seconds after appearing. Only the first page auto-refreshes, and
  // once you have paged past it the refresh stops until you narrow the
  // view again.
  const pipelineBusy =
    !!status && (status.proxied < status.total || status.tagged < status.total);
  const pagedBeyondFirst = assets.length > PAGE_SIZE;
  useEffect(() => {
    if (!pipelineBusy || pagedBeyondFirst) return;
    const iv = setInterval(() => void load(true), 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineBusy, pagedBeyondFirst, filter, debouncedQ]);

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
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1 md:flex">
            <LayoutGrid className="mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
            {COLUMN_CHOICES.map((n) => (
              <button
                key={n}
                onClick={() => chooseCols(n)}
                aria-pressed={cols === n}
                title={dict.video.library.columnsN.replace('{n}', String(n))}
                className={cn(
                  'min-w-[26px] rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors',
                  cols === n
                    ? 'border-brand-btn bg-brand-btn text-white'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {n}
              </button>
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
        <div
          className="grid gap-3"
          style={{
            // minmax(0,1fr) stops a wide image forcing its track open.
            gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
          }}
        >
          {assets.map((a, i) => (
            <figure
              key={a.id}
              className="group cursor-pointer overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
              onDoubleClick={() => setLightboxIdx(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ idx: i, x: e.clientX, y: e.clientY });
              }}
              title={dict.video.library.openHint}
            >
              <div className="relative aspect-square bg-muted">
                {a.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.thumb_url}
                    alt={a.file_name}
                    loading="lazy"
                    // Square-cropped at rest so the grid reads as an even
                    // sheet; on hover it switches to contain, which
                    // letterboxes to the picture's real proportions.
                    className="h-full w-full object-cover transition-all duration-200 group-hover:scale-[0.97] group-hover:object-contain"
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
                {a.width && a.height && (
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {a.width}×{a.height}
                  </span>
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
              <figcaption className={cn('p-2', effectiveCols > CAPTION_MAX_COLS && 'hidden')}>
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

      <AnamayaLightbox
        images={assets.map((a) => ({
          url: a.proxy_url ?? a.thumb_url ?? '',
          alt: a.file_name,
          caption:
            a.width && a.height
              ? `${a.file_name} · ${a.width}×${a.height}`
              : a.file_name,
        }))}
        index={lightboxIdx}
        onClose={() => setLightboxIdx(null)}
        onIndex={setLightboxIdx}
        onContextMenu={(e, i) => {
          e.preventDefault();
          setMenu({ idx: i, x: e.clientX, y: e.clientY });
        }}
      />

      <UpscaleMenu
        menu={menu}
        asset={menu ? assets[menu.idx] : null}
        dict={dict}
        onClose={() => setMenu(null)}
      />

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
