'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Maximize2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Check,
  TriangleAlert,
} from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

type Asset = {
  id: string;
  file_name: string;
  width: number | null;
  height: number | null;
  mime_type: string;
  drive_path: string | null;
};

/**
 * Right-click menu on a library tile or the enlarged photo.
 *
 * The grid serves a 1280px proxy, but most originals in this library
 * are far bigger, so "get the original" is usually the real answer to
 * wanting more pixels and is shown first with its true size. The
 * multipliers resample the original with Lanczos - more pixels, the
 * same picture. No model is involved and none of it invents detail.
 */
/** The library strings, kept in one place for the dialog below. */
function t2(dict: TranslationKeys) {
  return dict.video.library;
}

type Job =
  | { state: 'working'; factor: number; name: string }
  | { state: 'done'; name: string; size: string; existed: boolean }
  | { state: 'error'; message: string };

export function UpscaleMenu({
  menu,
  asset,
  dict,
  onClose,
  onCreated,
}: {
  menu: { idx: number; x: number; y: number } | null;
  asset: Asset | null;
  dict: TranslationKeys;
  onClose: () => void;
  /** Called once an enlarged copy lands, so the grid can pick it up. */
  onCreated?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    // While a job is in flight the dialog owns the screen; a stray
    // click must not dismiss it and leave the work invisible.
    if (!menu || job) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, job, onClose]);

  const enlarge = async (factor: number) => {
    if (!asset) return;
    const base = asset.file_name.replace(/\.[^.]+$/, '');
    setJob({ state: 'working', factor, name: `${base} ${factor}x.webp` });
    try {
      const res = await fetch('/api/video/enlarge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: asset.id, factor }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJob({ state: 'error', message: json.error ?? `Failed (${res.status})` });
        return;
      }
      setJob({
        state: 'done',
        name: json.name,
        size: json.width && json.height ? `${json.width}×${json.height}` : '',
        existed: !!json.existed,
      });
      onCreated?.();
    } catch (err) {
      setJob({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  // The progress dialog outlives the menu, so it is rendered first and
  // independently of it.
  if (job) {
    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          e.stopPropagation();
          if (job.state !== 'working') {
            setJob(null);
            onClose();
          }
        }}
      >
        <div
          className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {job.state === 'working' && (
            <>
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-brand-btn" />
                {t2(dict).enlarging.replace('{n}', String(job.factor))}
              </div>
              <p className="text-sm text-muted-foreground">
                {t2(dict).enlargingBody}
              </p>
              <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                {job.name}
              </p>
            </>
          )}
          {job.state === 'done' && (
            <>
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Check className="h-4 w-4 text-success" />
                {job.existed ? t2(dict).enlargeExisted : t2(dict).enlargeDone}
              </div>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {job.name} {job.size && `· ${job.size}`}
              </p>
              <button
                className="mt-4 w-full rounded-lg bg-brand-btn px-3 py-2 text-sm text-white hover:bg-brand-btn-hover"
                onClick={() => {
                  setJob(null);
                  onClose();
                }}
              >
                {t2(dict).close}
              </button>
            </>
          )}
          {job.state === 'error' && (
            <>
              <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
                <TriangleAlert className="h-4 w-4" />
                {t2(dict).enlargeFailed}
              </div>
              <p className="text-sm text-muted-foreground">{job.message}</p>
              <button
                className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => {
                  setJob(null);
                  onClose();
                }}
              >
                {t2(dict).close}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!menu || !asset) return null;
  const t = dict.video.library;
  const isImage = asset.mime_type.startsWith('image/');
  const long = Math.max(asset.width ?? 0, asset.height ?? 0);

  const downloadOriginal = () => {
    window.location.href = `/api/video/original?id=${asset.id}`;
    onClose();
  };

  // Keep the menu on screen near the right or bottom edge.
  const style: React.CSSProperties = {
    left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250),
    top: Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 260),
  };

  return (
    <div
      ref={ref}
      className="fixed z-[70] w-56 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      style={style}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <div className="truncate border-b border-border px-3 py-2 text-xs font-medium">
        {asset.file_name}
        {asset.width && asset.height && (
          <span className="ml-1 font-normal text-muted-foreground">
            {asset.width}×{asset.height}
          </span>
        )}
      </div>

      <button
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
        onClick={downloadOriginal}
      >
        <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1">{t.downloadOriginal}</span>
        {long > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground">{long}px</span>
        )}
      </button>

      {isImage && (
        <>
          <div className="border-t border-border px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {t.enlargeHeading}
          </div>
          {[2, 3, 4].map((f) => {
            const result = long ? long * f : 0;
            const tooBig = result > 8000;
            return (
              <button
                key={f}
                role="menuitem"
                disabled={tooBig}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
                onClick={() => void enlarge(f)}
                title={tooBig ? t.enlargeTooBig : undefined}
              >
                <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{f}×</span>
                {result > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {tooBig ? '—' : `${result}px`}
                  </span>
                )}
              </button>
            );
          })}
          <p className="border-t border-border px-3 py-2 text-[10px] leading-snug text-muted-foreground">
            {t.enlargeNote}
          </p>
        </>
      )}

      {asset.drive_path && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate" title={asset.drive_path}>
            {asset.drive_path}
          </span>
        </div>
      )}
      {!isImage && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
          <ImageIcon className="h-3 w-3" /> {t.enlargeImagesOnly}
        </div>
      )}
    </div>
  );
}
