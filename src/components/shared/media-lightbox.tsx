'use client';

import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Full-screen media viewer.
 *
 * Lifted from the pattern already in modules/admin/org-graphics-panel
 * so the app has one way of showing a picture large, rather than a
 * second one that looks almost but not quite the same. Adds keyboard
 * control and prev/next, because the media library shows thousands of
 * images and closing the viewer to reach the next one is painful.
 */
export type LightboxItem = {
  url: string;
  file_name: string;
  mime_type?: string;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
};

export function MediaLightbox({
  item,
  onClose,
  onPrev,
  onNext,
}: {
  item: LightboxItem | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    },
    [onClose, onPrev, onNext],
  );

  useEffect(() => {
    if (!item) return;
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll while this is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onKey]);

  if (!item) return null;
  const isVideo = item.mime_type?.startsWith('video/');
  const ratio =
    item.width && item.height
      ? `${item.width}×${item.height}`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.file_name}
    >
      <button
        className="absolute right-4 top-4 z-10 text-white/80 transition-colors hover:text-white"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-8 w-8" />
      </button>

      {onPrev && (
        <button
          className="absolute left-3 z-10 rounded-full bg-black/40 p-2 text-white/70 transition-colors hover:bg-black/60 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}
      {onNext && (
        <button
          className="absolute right-3 z-10 rounded-full bg-black/40 p-2 text-white/70 transition-colors hover:bg-black/60 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {isVideo ? (
        <video
          src={item.url}
          className="max-h-[88vh] max-w-[92vw] object-contain"
          controls
          autoPlay
          loop
          playsInline
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.file_name}
          className="max-h-[88vh] max-w-[92vw] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <div
        className="absolute bottom-4 left-1/2 max-w-[92vw] -translate-x-1/2 rounded-md bg-black/60 px-3 py-1.5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="truncate text-sm text-white">{item.file_name}</div>
        {(ratio || item.caption) && (
          <div className="truncate text-[11px] text-white/60">
            {[ratio, item.caption].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
