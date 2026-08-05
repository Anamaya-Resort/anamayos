'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScanLine, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';
import type { WorkerStatus } from '@/modules/video/worker-status';
import { WorkerBanner } from './WorkerBanner';

type Detection = {
  label: string;
  kind: 'face' | 'object';
  role: 'primary' | 'secondary' | 'none';
  bbox: [number, number, number, number];
};
type Asset = {
  id: string;
  file_name: string;
  image_url: string | null;
  color_temp: string | null;
  aesthetic_score: number | null;
  detections: Detection[];
  tags: { category: string; tag: string }[];
  summary: string;
  top_archetype: { name: string; score: number } | null;
};
type Feed = {
  progress: { done: number; analyzing: number; pending: number; error: number; total: number };
  worker: WorkerStatus;
  assets: Asset[];
};

// phase: 0 image loading · 1 scanning · 2 boxes · 3 chips · 4 score+hold
const PHASE_MS = [0, 900, 1100, 1600, 2600];

export function ScanTheater({ dict }: { dict: TranslationKeys }) {
  const [progress, setProgress] = useState<Feed['progress'] | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [current, setCurrent] = useState<Asset | null>(null);
  const [phase, setPhase] = useState(0);
  const [idle, setIdle] = useState(true);
  const seen = useRef<Set<string>>(new Set());
  const queue = useRef<Asset[]>([]);
  const playing = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Holds the latest playNext so the advance-timer can recurse without
  // referencing the callback before it's declared.
  const playNextRef = useRef<() => void>(() => {});

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const playNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next) {
      playing.current = false;
      setIdle(true);
      return;
    }
    playing.current = true;
    setIdle(false);
    setCurrent(next);
    setPhase(0);
    // image onLoad advances 0→1; the rest are timed
    timers.current.push(
      setTimeout(() => setPhase(2), PHASE_MS[1]),
      setTimeout(() => setPhase(3), PHASE_MS[2]),
      setTimeout(() => setPhase(4), PHASE_MS[3]),
      setTimeout(() => {
        clearTimers();
        playNextRef.current();
      }, PHASE_MS[4]),
    );
  }, []);

  // Keep the recursion target current without writing the ref during render.
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/video/scan-feed');
      if (!res.ok) return;
      const feed: Feed = await res.json();
      setProgress(feed.progress);
      setWorker(feed.worker ?? null);
      // assets come newest-first; enqueue unseen oldest-first so the
      // show plays in scan order
      const fresh = feed.assets.filter((a) => !seen.current.has(a.id)).reverse();
      for (const a of fresh) {
        seen.current.add(a.id);
        queue.current.push(a);
      }
      if (!playing.current && queue.current.length > 0) playNext();
    } catch {
      /* transient — next poll retries */
    }
  }, [playNext]);

  useEffect(() => {
    // Defer the first poll a tick so no setState is reachable
    // synchronously from this effect (poll's state writes are all
    // post-await anyway).
    const first = setTimeout(() => void poll(), 0);
    const iv = setInterval(() => void poll(), 4000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
      clearTimers();
    };
  }, [poll]);

  const replay = () => {
    clearTimers();
    queue.current = [];
    seen.current.clear();
    playing.current = false;
    setIdle(true);
    setCurrent(null);
    void poll();
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
  const caughtUp = !!progress && idle;

  return (
    <Card className="overflow-hidden p-4">
      {/* An empty theater means either "all caught up" or "the worker
          is dead". Those look identical without this. */}
      {worker && !worker.online && (
        <div className="mb-4">
          <WorkerBanner worker={worker} dict={dict} />
        </div>
      )}

      {/* progress + stages */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <ScanLine className="h-4 w-4 text-brand-highlight" />
            {dict.video.scan.title}
          </span>
          <span className="text-muted-foreground">
            {progress ? `${progress.done} / ${progress.total} ${dict.video.scan.tagged}` : '…'}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand-highlight transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!current ? (
        <div className="flex h-72 flex-col items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          {dict.video.scan.waiting}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* image + detection overlay */}
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.image_url ?? ''}
              alt={current.file_name}
              className="block max-h-[58vh] w-auto rounded-lg"
              onLoad={() => setPhase((p) => (p === 0 ? 1 : p))}
            />
            {/* scanning sweep */}
            {phase === 1 && (
              <div className="pointer-events-none absolute inset-0 animate-pulse rounded-lg bg-brand-highlight/10" />
            )}
            {/* detection boxes */}
            {phase >= 2 &&
              current.detections.map((d, i) => {
                const [x, y, w, h] = d.bbox;
                const isFace = d.kind === 'face';
                const primary = d.role === 'primary';
                return (
                  <div
                    key={i}
                    className={`animate-in fade-in zoom-in-95 absolute rounded ${
                      isFace
                        ? primary
                          ? 'border-2 border-brand-btn'
                          : 'border border-brand-btn/70'
                        : 'border-2 border-brand-highlight'
                    }`}
                    style={{
                      left: `${x * 100}%`,
                      top: `${y * 100}%`,
                      width: `${w * 100}%`,
                      height: `${h * 100}%`,
                      animationDelay: `${i * 90}ms`,
                    }}
                  >
                    <span
                      className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-medium text-white ${
                        isFace ? 'bg-brand-btn' : 'bg-brand-highlight'
                      }`}
                    >
                      {primary ? `${d.label} (primary)` : d.label}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* summary */}
          <p className="max-w-2xl text-center text-sm text-muted-foreground">
            {current.summary}
          </p>

          {/* chips fly in */}
          {phase >= 3 && (
            <div className="flex max-w-3xl flex-wrap justify-center gap-1.5">
              {current.top_archetype && (
                <Badge className="animate-in fade-in slide-in-from-bottom-2 bg-brand-btn text-white">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {current.top_archetype.name} ·{' '}
                  {Math.round(current.top_archetype.score * 100)}%
                </Badge>
              )}
              {current.color_temp && (
                <Badge variant="outline" className="animate-in fade-in">
                  {current.color_temp} light
                </Badge>
              )}
              {current.tags.slice(0, 14).map((t, i) => (
                <Badge
                  key={`${t.category}-${t.tag}-${i}`}
                  variant="secondary"
                  className="animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {t.tag}
                </Badge>
              ))}
            </div>
          )}

          {/* aesthetic score */}
          {phase >= 4 && current.aesthetic_score != null && (
            <div className="animate-in fade-in zoom-in-95 text-sm">
              <span className="text-muted-foreground">aesthetic </span>
              <span className="text-lg font-semibold text-brand-highlight">
                {current.aesthetic_score.toFixed(1)}
              </span>
              <span className="text-muted-foreground"> / 10</span>
            </div>
          )}
        </div>
      )}

      {caughtUp && progress && progress.done > 0 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>
            {progress.pending + progress.analyzing > 0
              ? dict.video.scan.waiting
              : `${dict.video.scan.allTagged} (${progress.done})`}
          </span>
          <Button variant="outline" size="sm" onClick={replay}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {dict.video.scan.replay}
          </Button>
        </div>
      )}
    </Card>
  );
}
