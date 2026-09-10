'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Images, Copy, Check, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { TranslationKeys } from '@/i18n/en';

type Gallery = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_published: boolean;
  item_count: number;
  updated_at: string;
  previews: string[];
};

/**
 * Galleries as rows, each showing what is in it and the code that puts
 * it on a page. Copying the code is the job this page exists for, so
 * it is one click and confirms it happened.
 */
export function GalleryList({
  galleries,
  dict,
}: {
  galleries: Gallery[];
  dict: TranslationKeys;
}) {
  const t = dict.video.galleries;
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked; the code is visible to select by hand */
    }
  };

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
    <div className="space-y-2">
      {galleries.map((g) => (
        <Card key={g.id} className="flex items-center gap-4 p-3">
          <div className="flex shrink-0 gap-1">
            {g.previews.length > 0 ? (
              g.previews.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" className="h-16 w-16 rounded object-cover" />
              ))
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-muted-foreground">
                <Images className="h-5 w-5" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
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

          <button
            onClick={() => void copy(g.code)}
            title={t.copyCode}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-1.5 font-mono text-xs transition-colors hover:bg-muted"
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
        </Card>
      ))}
    </div>
  );
}
