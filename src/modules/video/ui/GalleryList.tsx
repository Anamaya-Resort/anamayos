'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Images, Copy, Check, Plus, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AnamayaLightbox from '@/components/shared/anamaya-lightbox';
import { UpscaleMenu } from './UpscaleMenu';
import { cn } from '@/lib/utils';
import type { TranslationKeys } from '@/i18n/en';
import type { GallerySummary, GalleryItem } from '@/modules/video/galleries/queries';

/** Thumbnails stand 160px tall; width follows each picture's own ratio. */
const STRIP_H = 160;

/**
 * Galleries as rows: what it is on the left, what is in it on the
 * right. The strip keeps every picture's real proportions rather than
 * squaring them off, which is the only way to judge a gallery at a
 * glance, and drags sideways when it overflows.
 *
 * The lightbox and the right-click menu are the same components the
 * image grid uses, so an image behaves identically wherever it is met.
 */
export function GalleryList({
  galleries,
  dict,
}: {
  galleries: GallerySummary[];
  dict: TranslationKeys;
}) {
  const t = dict.video.galleries;
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: GalleryItem[]; idx: number } | null>(
    null,
  );
  const [menu, setMenu] = useState<{
    galleryId: string;
    item: GalleryItem;
    x: number;
    y: number;
  } | null>(null);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked; the code is on screen to select by hand */
    }
  };

  const removeItem = useCallback(
    async (galleryId: string, assetId: string) => {
      await fetch('/api/video/galleries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId, assetIds: [assetId] }),
      });
      router.refresh();
    },
    [router],
  );

  if (galleries.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <Images className="h-7 w-7" />
        <p>{t.noneYetLong}</p>
        <Link
          href="/dashboard/images"
          className="flex items-center gap-2 rounded-lg bg-brand-btn px-4 py-2 text-sm text-white hover:bg-brand-btn-hover"
        >
          <Plus className="h-4 w-4" />
          {t.goPickImages}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {galleries.map((g) => (
        <Card key={g.id} className="flex gap-5 p-4">
          {/* Left: what this gallery is */}
          <div className="flex w-56 shrink-0 flex-col gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{g.name}</span>
                {g.is_published && (
                  <span className="shrink-0 rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
                    {t.published}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.itemCount.replace('{n}', String(g.item_count))}
              </div>
            </div>
            {g.description && (
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {g.description}
              </p>
            )}
            <button
              onClick={() => void copy(g.code)}
              title={t.copyCode}
              className="mt-auto flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-1.5 font-mono text-xs transition-colors hover:bg-muted"
            >
              {copied === g.code ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" />
                  {t.copied}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  {g.code}
                </>
              )}
            </button>
          </div>

          {/* Right: the pictures */}
          <Filmstrip
            items={g.items}
            dict={dict}
            onOpen={(idx) => setLightbox({ items: g.items, idx })}
            onContext={(item, e) =>
              setMenu({ galleryId: g.id, item, x: e.clientX, y: e.clientY })
            }
          />
        </Card>
      ))}

      <AnamayaLightbox
        images={(lightbox?.items ?? []).map((i) => ({
          url: i.proxy_url ?? i.thumb_url ?? '',
          alt: i.file_name,
          caption:
            i.width && i.height ? `${i.file_name} · ${i.width}×${i.height}` : i.file_name,
        }))}
        index={lightbox?.idx ?? null}
        onClose={() => setLightbox(null)}
        onIndex={(i) => setLightbox((l) => (l ? { ...l, idx: i } : l))}
      />

      <UpscaleMenu
        menu={menu ? { idx: 0, x: menu.x, y: menu.y } : null}
        asset={menu?.item ?? null}
        dict={dict}
        onClose={() => setMenu(null)}
        onCreated={() => router.refresh()}
        onRemove={
          menu
            ? () => {
                const { galleryId, item } = menu;
                setMenu(null);
                void removeItem(galleryId, item.id);
              }
            : undefined
        }
        removeLabel={t.removeFromGallery}
      />
    </div>
  );
}

/**
 * Horizontal strip that drags sideways. A few pixels of movement
 * before it counts as a drag, so a click still lands on the picture
 * under the cursor rather than being eaten by the pan.
 */
function Filmstrip({
  items,
  dict,
  onOpen,
  onContext,
}: {
  items: GalleryItem[];
  dict: TranslationKeys;
  onOpen: (idx: number) => void;
  onContext: (item: GalleryItem, e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !ref.current) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 5) return;
    d.moved = true;
    setDragging(true);
    ref.current.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  if (items.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground"
        style={{ height: STRIP_H }}
      >
        {dict.video.galleries.emptyGallery}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      className={cn(
        'flex flex-1 gap-1 overflow-x-auto overflow-y-hidden',
        // The native bar is hidden: dragging is the gesture here, and a
        // scrollbar under a 160px strip is more furniture than help.
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        dragging ? 'cursor-grabbing select-none' : 'cursor-grab',
      )}
      style={{ height: STRIP_H }}
    >
      {items.map((it, idx) => {
        const ratio = it.width && it.height ? it.width / it.height : 4 / 3;
        return (
          <figure
            key={it.id}
            className="group relative h-full shrink-0 overflow-hidden rounded bg-muted"
            style={{ width: STRIP_H * ratio }}
            onDoubleClick={() => !drag.current?.moved && onOpen(idx)}
            onContextMenu={(e) => {
              e.preventDefault();
              onContext(it, e);
            }}
            title={it.file_name}
          >
            {it.thumb_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.thumb_url}
                alt={it.file_name}
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Images className="h-5 w-5" />
              </div>
            )}
            {it.mime_type.startsWith('video/') && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-black/45 p-1.5">
                  <Play className="h-3.5 w-3.5 fill-white text-white" />
                </span>
              </span>
            )}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/85 via-black/60 to-transparent px-2 pb-1 pt-3 text-white transition-transform duration-200 group-hover:translate-y-0">
              <div className="truncate text-[10px] font-medium">{it.file_name}</div>
              <div className="flex gap-2 text-[9px] text-white/75">
                {it.width && it.height && (
                  <span className="font-mono">
                    {it.width}×{it.height}
                  </span>
                )}
                {it.aesthetic_score != null && (
                  <span className="text-brand-highlight">
                    ★ {it.aesthetic_score.toFixed(1)}
                  </span>
                )}
              </div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
