'use client';

import { useEffect, useRef } from 'react';
import { Download, Maximize2, ExternalLink, Image as ImageIcon } from 'lucide-react';
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
export function UpscaleMenu({
  menu,
  asset,
  dict,
  onClose,
}: {
  menu: { idx: number; x: number; y: number } | null;
  asset: Asset | null;
  dict: TranslationKeys;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, onClose]);

  if (!menu || !asset) return null;
  const t = dict.video.library;
  const isImage = asset.mime_type.startsWith('image/');
  const long = Math.max(asset.width ?? 0, asset.height ?? 0);

  const go = (factor: number) => {
    // A plain navigation: the response is an attachment, so the browser
    // saves it without leaving the page.
    window.location.href = `/api/video/enlarge?id=${asset.id}&factor=${factor}`;
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
        onClick={() => go(1)}
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
                onClick={() => go(f)}
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
