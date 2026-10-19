'use client';

import { useState, useEffect, useMemo } from 'react';
import { Tags, ChevronDown, ChevronRight, Search, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslationKeys } from '@/i18n/en';

type Facet = { category: string; tag: string; n: number };

/** Order the model's categories are shown in: what a picture IS
 *  first, then how it feels, then what it is for. */
const ORDER = ['subject', 'activity', 'mood', 'people', 'marketing_use', 'media', 'other'];

/**
 * The collection's vocabulary, as something you can read and click.
 *
 * There were 1,445 tags and 87,598 assignments with no way to see any
 * of them: the only way in was guessing words into the search box,
 * which meant the tagging the library paid for was largely unusable.
 *
 * Collapsed by default, because the grid is the point of the page and
 * a wall of keywords above it would bury the photographs.
 */
export function TagBrowser({
  dict, activeTag, onPick,
}: {
  dict: TranslationKeys;
  activeTag: string | null;
  onPick: (tag: string | null) => void;
}) {
  const t = dict.video.tags;
  const [open, setOpen] = useState(false);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/video/tags?limit=600');
        const json = await res.json();
        if (!cancelled && res.ok) setFacets(json.facets ?? []);
      } catch {
        // the grid still works without the keyword list
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = new Map<string, Facet[]>();
    for (const f of facets) {
      if (needle && !f.tag.toLowerCase().includes(needle)) continue;
      const list = out.get(f.category) ?? [];
      list.push(f);
      out.set(f.category, list);
    }
    return [...out.entries()].sort(
      (a, b) => (ORDER.indexOf(a[0]) + 1 || 99) - (ORDER.indexOf(b[0]) + 1 || 99),
    );
  }, [facets, q]);

  const label = (c: string) =>
    (t.categories as Record<string, string>)[c] ?? c.replace(/_/g, ' ');

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Tags className="h-4 w-4 text-muted-foreground" />
          {t.title}
        </button>

        {activeTag && (
          <button
            onClick={() => onPick(null)}
            className="flex items-center gap-1 rounded-full bg-brand-btn/15 px-2 py-0.5 text-xs text-brand-btn hover:bg-brand-btn/25"
          >
            {activeTag}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-border p-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              className="w-full rounded border border-border bg-background py-1.5 pl-8 pr-2 text-sm"
            />
          </div>

          {loading ? (
            <div className="flex h-16 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t.none}</p>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {grouped.map(([cat, list]) => (
                <div key={cat}>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label(cat)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {list.map((f) => (
                      <button
                        key={`${f.category}:${f.tag}`}
                        onClick={() => onPick(activeTag === f.tag ? null : f.tag)}
                        className={cn(
                          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                          activeTag === f.tag
                            ? 'border-brand-btn bg-brand-btn/15 text-brand-btn'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        {f.tag}
                        <span className="text-[10px] text-muted-foreground">{f.n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
