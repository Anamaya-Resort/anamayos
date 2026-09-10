'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import justifiedLayout from 'justified-layout';
import { cn } from '@/lib/utils';
import { ImageOff, Play } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

export type CollageAsset = {
  id: string;
  file_name: string;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  aesthetic_score: number | null;
  analysis_status: string;
  duration_ms: number | null;
};

/**
 * Patchwork view: every photo at its true aspect ratio, packed edge to
 * edge with no gaps.
 *
 * This uses Flickr's justified-layout, the algorithm behind Flickr and
 * Google Photos. Worth knowing why it is the right one rather than
 * something more elaborate: preserving exact aspect ratios AND filling
 * the width AND leaving no gaps is over-constrained for arbitrary
 * rectangles, so one has to give. Justified layout gives on ROW HEIGHT
 * - it groups photos into rows and picks each row's height so that
 * row's pictures scale to fill the width exactly. Rows therefore have
 * different heights from one another, which is what produces the
 * patchwork; a portrait next to two landscapes makes a short row, four
 * panoramas a tall one. Nothing is cropped and nothing is squashed.
 *
 * The alternative that packs a rectangle truly perfectly is a
 * squarified treemap, but it gets there by distorting aspect ratios,
 * which is the one thing this view exists to show.
 */
const TARGET_ROW_HEIGHT: Record<number, number> = {
  3: 420,
  4: 320,
  5: 260,
  8: 170,
  12: 120,
  20: 80,
};

export function CollageView({
  assets,
  cols,
  dict,
  selectedIds,
  onTileClick,
  onTileDoubleClick,
  onTileContextMenu,
}: {
  assets: CollageAsset[];
  /** Reuses the density control: fewer columns means taller rows. */
  cols: number;
  dict: TranslationKeys;
  selectedIds: Set<string>;
  onTileClick: (i: number, shift: boolean) => void;
  onTileDoubleClick: (i: number) => void;
  onTileContextMenu: (i: number, e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // The layout is computed in pixels, so it needs the real width and
  // must recompute when the window or sidebar changes it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    setContainerWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!containerWidth || assets.length === 0) return null;
    // A missing size would break the packing, so anything unmeasured
    // stands in as 4:3 rather than being dropped from the view.
    const boxes = assets.map((a) => ({
      width: a.width ?? 400,
      height: a.height ?? 300,
    }));
    return justifiedLayout(boxes, {
      containerWidth,
      containerPadding: 0,
      boxSpacing: 1,
      targetRowHeight: TARGET_ROW_HEIGHT[cols] ?? 260,
      targetRowHeightTolerance: 0.3,
      // The last row is scaled to fit like any other, so the block ends
      // flush instead of trailing off.
      showWidows: true,
    });
  }, [assets, containerWidth, cols]);

  return (
    <div ref={ref} className="relative w-full">
      {layout && (
        <div className="relative w-full" style={{ height: layout.containerHeight }}>
          {assets.map((a, i) => {
            const box = layout.boxes[i];
            if (!box) return null;
            const isVideo = a.mime_type.startsWith('video/');
            const selected = selectedIds.has(a.id);
            return (
              <figure
                key={a.id}
                className={cn(
                  'group absolute cursor-pointer select-none overflow-hidden bg-muted',
                  selected && 'ring-2 ring-inset ring-brand-btn',
                )}
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                }}
                onClick={(e) => onTileClick(i, e.shiftKey)}
                onDoubleClick={() => onTileDoubleClick(i)}
                onContextMenu={(e) => onTileContextMenu(i, e)}
                title={a.file_name}
              >
                {a.thumb_url ? (
                  // The box already matches the picture's ratio, so
                  // cover crops nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.thumb_url}
                    alt={a.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-5 w-5" />
                  </div>
                )}

                {isVideo && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/45 p-2">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </span>
                  </span>
                )}

                {/* Details ride in on a lightened strip along the
                    bottom, so the picture is unobstructed at rest. */}
                <figcaption
                  className={cn(
                    'pointer-events-none absolute inset-x-0 bottom-0 translate-y-full',
                    'bg-gradient-to-t from-black/80 via-black/60 to-transparent',
                    'px-2 pb-1.5 pt-4 text-white transition-transform duration-200',
                    'group-hover:translate-y-0',
                  )}
                >
                  <div className="truncate text-[11px] font-medium">{a.file_name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-white/75">
                    {a.width && a.height && (
                      <span className="font-mono">
                        {a.width}×{a.height}
                      </span>
                    )}
                    {a.analysis_status === 'done' && a.aesthetic_score != null && (
                      <span className="text-brand-highlight">
                        ★ {a.aesthetic_score.toFixed(1)}
                      </span>
                    )}
                    {a.analysis_status !== 'done' && (
                      <span className="opacity-70">{dict.video.library.untagged}</span>
                    )}
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
