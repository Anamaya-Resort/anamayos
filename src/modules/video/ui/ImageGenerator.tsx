'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles, Loader2, Check, TriangleAlert, X, Search, ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslationKeys } from '@/i18n/en';

/** Nano Banana Pro's documented ceiling for mixed references. */
const MAX_REFS = 14;

const SHAPES = ['16:9', '4:3', '1:1', '3:4', '9:16'] as const;
const SIZES = ['1K', '2K', '4K'] as const;

type Pick = { id: string; thumb_url: string | null; file_name: string };

type Job =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'done'; id: string; name: string; refs: number }
  | { state: 'failed'; message: string };

/**
 * Generate a photograph in the style of chosen library images.
 *
 * The reference strip is the whole point. A prose description of
 * light never lands the way six of Anamaya's own photographs do, so
 * picking them is the primary control and the prompt is secondary.
 */
export function ImageGenerator({ dict }: { dict: TranslationKeys }) {
  const t = dict.video.generate;
  const [prompt, setPrompt] = useState('');
  const [refs, setRefs] = useState<Pick[]>([]);
  const [shape, setShape] = useState<(typeof SHAPES)[number]>('16:9');
  const [size, setSize] = useState<(typeof SIZES)[number]>('2K');
  const [job, setJob] = useState<Job>({ state: 'idle' });

  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Pick[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (term: string) => {
    setSearching(true);
    try {
      const res = await fetch(
        `/api/video/library?filter=all&sort=newest&q=${encodeURIComponent(term)}&offset=0`,
      );
      const json = await res.json();
      if (res.ok) {
        setFound(
          ((json.assets ?? []) as Pick[]).map((a) => ({
            id: a.id, thumb_url: a.thumb_url, file_name: a.file_name,
          })),
        );
      }
    } catch {
      // the picker degrades to whatever is already chosen
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!picking) return;
    const h = setTimeout(() => void search(q), 300);
    return () => clearTimeout(h);
  }, [picking, q, search]);

  const toggle = (p: Pick) =>
    setRefs((cur) =>
      cur.some((c) => c.id === p.id)
        ? cur.filter((c) => c.id !== p.id)
        : cur.length >= MAX_REFS
          ? cur
          : [...cur, p],
    );

  const go = async () => {
    setJob({ state: 'working' });
    try {
      const res = await fetch('/api/video/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          referenceIds: refs.map((r) => r.id),
          aspect: shape,
          size,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setJob({ state: 'done', id: json.id, name: json.name, refs: json.referencesUsed ?? 0 });
    } catch (err) {
      setJob({ state: 'failed', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const busy = job.state === 'working';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t.prompt}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t.promptPlaceholder}
          rows={3}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* References */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.style}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.styleHint.replace('{n}', String(MAX_REFS))}
            </p>
          </div>
          <button
            onClick={() => setPicking((p) => !p)}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t.pick} ({refs.length}/{MAX_REFS})
          </button>
        </div>

        {refs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {refs.map((r) => (
              <div key={r.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumb_url ?? ''}
                  alt={r.file_name}
                  className="h-16 w-16 rounded object-cover"
                />
                <button
                  onClick={() => toggle(r)}
                  className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 shadow ring-1 ring-border"
                  aria-label={dict.video.editor.cancel}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {picking && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={dict.video.library.search}
                className="w-full rounded border border-border bg-background py-1.5 pl-8 pr-2 text-sm"
              />
            </div>
            {searching ? (
              <div className="flex h-20 items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-10">
                {found.map((f) => {
                  const on = refs.some((r) => r.id === f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggle(f)}
                      title={f.file_name}
                      className={cn(
                        'relative aspect-square overflow-hidden rounded ring-2 transition-all',
                        on ? 'ring-brand-btn' : 'ring-transparent hover:ring-border',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.thumb_url ?? ''}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {on && (
                        <span className="absolute inset-0 flex items-center justify-center bg-brand-btn/35">
                          <Check className="h-4 w-4 text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shape, size, go */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {t.shape}
          </div>
          <div className="flex gap-1">
            {SHAPES.map((sh) => (
              <button
                key={sh}
                onClick={() => setShape(sh)}
                className={cn('rounded border px-2 py-1 font-mono text-xs',
                  shape === sh ? 'border-brand-btn bg-brand-btn/10 text-brand-btn' : 'border-border hover:bg-muted')}
              >
                {sh}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {t.size}
          </div>
          <div className="flex gap-1">
            {SIZES.map((sz) => (
              <button
                key={sz}
                onClick={() => setSize(sz)}
                className={cn('rounded border px-2 py-1 font-mono text-xs',
                  size === sz ? 'border-brand-btn bg-brand-btn/10 text-brand-btn' : 'border-border hover:bg-muted')}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => void go()}
          disabled={busy || prompt.trim().length < 3}
          className="ml-auto flex items-center gap-2 rounded-lg bg-brand-btn px-5 py-2 text-sm text-white hover:bg-brand-btn-hover disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? t.working : t.go}
        </button>
      </div>

      {job.state === 'working' && (
        <p className="text-sm text-muted-foreground">{t.workingBody}</p>
      )}

      {job.state === 'done' && (
        <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
          <Check className="h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{t.done}</div>
            <div className="truncate text-xs text-muted-foreground">{job.name}</div>
          </div>
          <Link
            href="/dashboard/images?sort=newest"
            className="shrink-0 rounded-lg border border-border px-3 py-2 hover:bg-muted"
          >
            <ImageIcon className="mr-1 inline h-4 w-4" />
            {dict.nav.allImages}
          </Link>
        </div>
      )}

      {job.state === 'failed' && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <div className="font-medium">{t.failed}</div>
            <div className="break-words text-xs text-muted-foreground">{job.message}</div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">{t.labelled}</p>
    </div>
  );
}
