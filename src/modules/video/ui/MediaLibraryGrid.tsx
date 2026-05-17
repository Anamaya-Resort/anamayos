'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search, ImageOff, Loader2, Copy, FileVideo, FileAudio } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

type Asset = {
  id: string;
  file_name: string;
  drive_path: string | null;
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  thumb_url: string | null;
  proxy_status: string;
  duplicate_status: string | null;
};

type Resp = { total: number; offset: number; pageSize: number; assets: Asset[] };

const FILTERS = [
  { id: 'all', key: 'filterAll' },
  { id: 'recent', key: 'filterRecent' },
  { id: 'duplicates', key: 'filterDuplicates' },
] as const;

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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      const nextOffset = reset ? 0 : offset;
      try {
        const res = await fetch(
          `/api/video/library?filter=${filter}&q=${encodeURIComponent(debouncedQ)}&offset=${nextOffset}`,
        );
        const json: Resp = await res.json();
        if (!res.ok) return;
        setTotal(json.total);
        setAssets((prev) => (reset ? json.assets : [...prev, ...json.assets]));
        setOffset(nextOffset + json.pageSize);
      } finally {
        setLoading(false);
      }
    },
    [filter, debouncedQ, offset],
  );

  // Reload from scratch when filter/search changes.
  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedQ]);

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

      <p className="mb-3 text-xs text-muted-foreground">
        {total.toLocaleString()} {dict.video.library.items}
      </p>

      {assets.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
          <ImageOff className="mb-2 h-6 w-6" />
          {dict.video.library.empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((a) => (
            <figure key={a.id} className="group overflow-hidden rounded-lg border bg-card">
              <div className="relative aspect-square bg-muted">
                {a.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.thumb_url}
                    alt={a.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover"
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
                {a.duplicate_status && (
                  <Badge className="absolute right-1.5 top-1.5 bg-warning/90 text-warning-foreground">
                    <Copy className="mr-1 h-3 w-3" />
                    {a.duplicate_status}
                  </Badge>
                )}
              </div>
              <figcaption className="p-2">
                <div className="truncate text-xs font-medium" title={a.file_name}>
                  {a.file_name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {a.width && a.height ? `${a.width}×${a.height} · ` : ''}
                  {humanSize(a.size_bytes)}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

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
