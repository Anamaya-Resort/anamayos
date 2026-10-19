'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop as CropIcon, RotateCw, RotateCcw, FlipHorizontal, FlipVertical,
  Loader2, Check, TriangleAlert, X, Sparkles, Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslationKeys } from '@/i18n/en';

type Rect = { x: number; y: number; w: number; h: number };

const ASPECTS: { key: string; label: string; r: number | null }[] = [
  { key: 'free', label: '', r: null },
  { key: '1:1', label: '1:1', r: 1 },
  { key: '4:3', label: '4:3', r: 4 / 3 },
  { key: '3:4', label: '3:4', r: 3 / 4 },
  { key: '16:9', label: '16:9', r: 16 / 9 },
];

type Job =
  | { state: 'idle' }
  | { state: 'working'; what: string }
  | { state: 'done'; name: string; existed: boolean }
  | { state: 'failed'; message: string };

/**
 * Crop, rotate, straighten, flip, and the two AI actions.
 *
 * One modal for all of it because they are the same decision: you
 * frame the picture you want, then choose how it should be produced.
 * Separating "crop" from "crop and add detail" into two screens would
 * mean framing the same shot twice.
 *
 * Everything here writes a new image. The library holds only a 1280px
 * preview of anything scanned, so editing in place would destroy the
 * only copy it has, and that is said on screen rather than assumed.
 */
export function ImageEditorModal({
  open, asset, dict, onClose, onSaved,
}: {
  open: boolean;
  asset: { id: string; file_name: string; proxy_url: string | null; thumb_url: string | null;
           width: number | null; height: number | null } | null;
  dict: TranslationKeys;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = dict.video.editor;
  const [crop, setCrop] = useState<Rect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [aspect, setAspect] = useState('free');
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [straighten, setStraighten] = useState(0);
  const [flip, setFlip] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const [size, setSize] = useState<'2K' | '4K'>('4K');
  const [job, setJob] = useState<Job>({ state: 'idle' });
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; o: Rect } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
    setAspect('free'); setRotate(0); setStraighten(0);
    setFlip('none'); setJob({ state: 'idle' });
  }, [open, asset?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && job.state !== 'working') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, job.state, onClose]);

  // Aspect is enforced by shrinking the crop, never growing it, so
  // locking a shape can't push the box outside the picture.
  const applyAspect = useCallback((r: Rect, ratio: number | null, boxRatio: number): Rect => {
    if (!ratio) return r;
    // Fractions are of different axes, so the target must be
    // expressed in the picture's own proportions before comparing.
    const want = ratio / boxRatio;
    const h = Math.min(r.h, r.w / want);
    const w = h * want;
    return {
      x: Math.min(r.x, 1 - w),
      y: Math.min(r.y, 1 - h),
      w, h,
    };
  }, []);

  useEffect(() => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || !box.height) return;
    const def = ASPECTS.find((a) => a.key === aspect);
    if (!def?.r) return;
    setCrop((c) => applyAspect(c, def.r, box.width / box.height));
  }, [aspect, applyAspect]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current;
      const box = boxRef.current?.getBoundingClientRect();
      if (!d || !box) return;
      const dx = (e.clientX - d.sx) / box.width;
      const dy = (e.clientY - d.sy) / box.height;
      const def = ASPECTS.find((a) => a.key === aspect);
      if (d.mode === 'move') {
        setCrop({
          x: Math.min(Math.max(0, d.o.x + dx), 1 - d.o.w),
          y: Math.min(Math.max(0, d.o.y + dy), 1 - d.o.h),
          w: d.o.w, h: d.o.h,
        });
      } else {
        let w = Math.max(0.05, Math.min(d.o.w + dx, 1 - d.o.x));
        let h = Math.max(0.05, Math.min(d.o.h + dy, 1 - d.o.y));
        if (def?.r) {
          const want = def.r / (box.width / box.height);
          // Driven by whichever edge moved more, so a corner drag
          // feels like one gesture rather than fighting itself.
          if (Math.abs(dx) > Math.abs(dy)) h = w / want; else w = h * want;
          h = Math.min(h, 1 - d.o.y); w = Math.min(w, 1 - d.o.x);
        }
        setCrop({ x: d.o.x, y: d.o.y, w, h });
      }
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [aspect]);

  if (!open || !asset) return null;

  const cropped = crop.w < 0.995 || crop.h < 0.995;
  const geometry = rotate !== 0 || straighten !== 0 || flip !== 'none';

  const run = async (
    url: string,
    body: Record<string, unknown>,
    what: string,
  ) => {
    setJob({ state: 'working', what });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setJob({ state: 'done', name: json.name, existed: !!json.existed });
      onSaved();
    } catch (err) {
      setJob({ state: 'failed', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const cropArg = cropped ? { x: crop.x, y: crop.y, w: crop.w, h: crop.h } : undefined;

  const saveCrop = () =>
    run('/api/video/edit',
      { id: asset.id, rotate, straighten, flip, ...(cropArg ? { crop: cropArg } : {}) },
      t.saveCrop);

  const aiZoom = () =>
    run('/api/video/ai-enhance',
      { id: asset.id, mode: 'detail', size, ...(cropArg ? { crop: cropArg } : {}) },
      t.aiZoom);

  const aiQuality = () =>
    run('/api/video/ai-enhance', { id: asset.id, mode: 'quality', size }, t.aiQuality);

  const src = asset.proxy_url ?? asset.thumb_url ?? '';
  const busy = job.state === 'working';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <CropIcon className="h-5 w-5 text-brand-btn" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-medium">{t.title}</h2>
            <p className="truncate text-xs text-muted-foreground">{asset.file_name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
            aria-label={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto md:grid-cols-[1fr_280px]">
          {/* Picture + crop box */}
          <div className="flex items-center justify-center bg-muted/40 p-4">
            <div
              ref={boxRef}
              className="relative max-h-[60vh] select-none"
              style={{
                transform: `rotate(${rotate + straighten}deg) scaleX(${
                  flip === 'horizontal' ? -1 : 1
                }) scaleY(${flip === 'vertical' ? -1 : 1})`,
                transition: 'transform 120ms',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="max-h-[60vh] w-auto" draggable={false} />

              <div
                className="absolute cursor-move border-2 border-brand-btn shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  drag.current = { mode: 'move', sx: e.clientX, sy: e.clientY, o: crop };
                }}
              >
                <span
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm bg-brand-btn"
                  onMouseDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    drag.current = { mode: 'resize', sx: e.clientX, sy: e.clientY, o: crop };
                  }}
                />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 border-l border-border p-4 text-sm">
            <p className="text-xs text-muted-foreground">{t.cropHint}</p>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.aspect}
              </div>
              <div className="flex flex-wrap gap-1">
                {ASPECTS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAspect(a.key)}
                    className={cn(
                      'rounded border px-2 py-1 text-xs',
                      aspect === a.key
                        ? 'border-brand-btn bg-brand-btn/10 text-brand-btn'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    {a.label || t.free}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.rotate}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setRotate((r) => (((r + 270) % 360) as 0 | 90 | 180 | 270))}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setRotate((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setFlip((f) => (f === 'horizontal' ? 'none' : 'horizontal'))}
                  title={t.flipH}
                  className={cn('rounded border px-2 py-1 text-xs',
                    flip === 'horizontal' ? 'border-brand-btn text-brand-btn' : 'border-border hover:bg-muted')}
                >
                  <FlipHorizontal className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setFlip((f) => (f === 'vertical' ? 'none' : 'vertical'))}
                  title={t.flipV}
                  className={cn('rounded border px-2 py-1 text-xs',
                    flip === 'vertical' ? 'border-brand-btn text-brand-btn' : 'border-border hover:bg-muted')}
                >
                  <FlipVertical className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{t.straighten}</span>
                <span className="font-mono normal-case">{straighten > 0 ? '+' : ''}{straighten}&deg;</span>
              </div>
              <input
                type="range" min={-15} max={15} step={0.5} value={straighten}
                onChange={(e) => setStraighten(Number(e.target.value))}
                className="w-full accent-brand-btn"
              />
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.size}
              </div>
              <div className="flex gap-1">
                {(['2K', '4K'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={cn('rounded border px-2 py-1 text-xs',
                      size === s ? 'border-brand-btn bg-brand-btn/10 text-brand-btn' : 'border-border hover:bg-muted')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }); setRotate(0); setStraighten(0); setFlip('none'); }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              {t.reset}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-border p-4">
          {job.state === 'working' ? (
            <div className="flex items-center gap-3 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-brand-btn" />
              <div>
                <div className="font-medium">{t.working}: {job.what}</div>
                <div className="text-xs text-muted-foreground">{t.workingBody}</div>
              </div>
            </div>
          ) : job.state === 'done' ? (
            <div className="flex items-center gap-3 text-sm">
              <Check className="h-5 w-5 text-success" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.done}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {job.existed ? t.existed : job.name}
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                {t.close}
              </button>
            </div>
          ) : job.state === 'failed' ? (
            <div className="flex items-start gap-3 text-sm">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.failed}</div>
                <div className="break-words text-xs text-muted-foreground">{job.message}</div>
              </div>
              <button
                onClick={() => setJob({ state: 'idle' })}
                className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                {t.cancel}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void saveCrop()}
                  disabled={!cropped && !geometry}
                  title={t.saveCropHint}
                  className="flex items-center gap-2 rounded-lg bg-brand-btn px-4 py-2 text-sm text-white hover:bg-brand-btn-hover disabled:opacity-40"
                >
                  <CropIcon className="h-4 w-4" />
                  {t.saveCrop}
                </button>
                <button
                  onClick={() => void aiZoom()}
                  title={t.aiZoomHint}
                  className="flex items-center gap-2 rounded-lg border border-brand-btn px-4 py-2 text-sm text-brand-btn hover:bg-brand-btn/10"
                >
                  <Sparkles className="h-4 w-4" />
                  {t.aiZoom}
                </button>
                <button
                  onClick={() => void aiQuality()}
                  title={t.aiQualityHint}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  <Wand2 className="h-4 w-4" />
                  {t.aiQuality}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{t.newImage}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
