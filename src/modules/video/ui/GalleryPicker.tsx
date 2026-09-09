'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Loader2, Check, Images, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslationKeys } from '@/i18n/en';

export type StagedImage = { id: string; thumb_url: string | null; file_name: string };

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
 * Put a selection of images into a gallery.
 *
 * The chosen images sit in a staging strip along the top so it stays
 * obvious what is about to be filed, however long you spend hunting
 * for the destination. Picking a gallery highlights it and asks before
 * anything is written, since adding to the wrong one is tedious to
 * undo by hand.
 */
export function GalleryPicker({
  open,
  staged,
  dict,
  onClose,
  onDone,
  startInCreate,
}: {
  open: boolean;
  staged: StagedImage[];
  dict: TranslationKeys;
  onClose: () => void;
  onDone: (msg: string) => void;
  /** Opened via "New Gallery" rather than "Add to Gallery". */
  startInCreate?: boolean;
}) {
  const t = dict.video.galleries;
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/video/galleries');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      setGalleries(json.galleries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setQ('');
    setError(null);
    setCreating(!!startInCreate);
    setNewName('');
    void load();
  }, [open, startInCreate, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return galleries;
    return galleries.filter(
      (g) =>
        g.name.toLowerCase().includes(needle) ||
        g.code.toLowerCase().includes(needle) ||
        (g.description ?? '').toLowerCase().includes(needle),
    );
  }, [galleries, q]);

  const ids = staged.map((s) => s.id);

  const doCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/video/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), assetIds: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      onDone(
        t.createdMsg
          .replace('{n}', String(ids.length))
          .replace('{name}', newName.trim())
          .replace('{code}', json.code),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const doAdd = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/video/galleries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId: selected, assetIds: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
      const g = galleries.find((x) => x.id === selected);
      onDone(
        t.addedMsg
          .replace('{n}', String(json.added))
          .replace('{name}', g?.name ?? '')
          .replace('{dupes}', String(json.alreadyThere ?? 0)),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const chosen = galleries.find((g) => g.id === selected);

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Images className="h-5 w-5 text-brand-btn" />
            <h2 className="text-lg font-semibold">{t.title}</h2>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Staging strip: what is about to be filed */}
        <div className="border-b border-border bg-muted/40 px-5 py-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t.staging.replace('{n}', String(staged.length))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {staged.slice(0, 60).map((s) => (
              <div
                key={s.id}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-border bg-background"
                title={s.file_name}
              >
                {s.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumb_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Images className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {staged.length > 60 && (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-border text-xs text-muted-foreground">
                +{staged.length - 60}
              </div>
            )}
          </div>
        </div>

        {/* Search + create */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>
          <button
            onClick={() => {
              setCreating(true);
              setSelected(null);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-btn px-4 py-2 text-sm font-medium text-white hover:bg-brand-btn-hover"
          >
            <Plus className="h-4 w-4" />
            {t.newGallery}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="flex items-center gap-3 border-b border-border bg-brand-subtle/40 px-5 py-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void doCreate()}
              placeholder={t.namePlaceholder}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
            <button
              disabled={!newName.trim() || busy}
              onClick={() => void doCreate()}
              className="flex items-center gap-2 rounded-lg bg-brand-btn px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.createWith.replace('{n}', String(staged.length))}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              {t.cancel}
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Gallery rows */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Images className="h-6 w-6" />
              {galleries.length === 0 ? t.noneYet : t.noMatch}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((g) => {
                const isSel = selected === g.id;
                return (
                  <div key={g.id}>
                    <button
                      onClick={() => {
                        setSelected(isSel ? null : g.id);
                        setCreating(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-lg border p-3 text-left transition-colors',
                        isSel
                          ? 'border-brand-btn bg-brand-btn/10 ring-2 ring-brand-btn/30'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      <div className="flex shrink-0 gap-1">
                        {g.previews.length > 0 ? (
                          g.previews.map((u, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={u}
                              alt=""
                              className="h-14 w-14 rounded object-cover"
                            />
                          ))
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded bg-muted text-muted-foreground">
                            <Images className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{g.name}</span>
                          <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {g.code}
                          </code>
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
                      {isSel && <Check className="h-5 w-5 shrink-0 text-brand-btn" />}
                    </button>

                    {/* Confirm sits under the chosen row, so the answer is
                        next to the thing being answered about. */}
                    {isSel && (
                      <div className="mt-2 flex items-center gap-3 rounded-lg border border-brand-btn/40 bg-brand-btn/5 px-4 py-3">
                        <span className="flex-1 text-sm">
                          {t.confirmAdd
                            .replace('{n}', String(staged.length))
                            .replace('{name}', g.name)}
                        </span>
                        <button
                          disabled={busy}
                          onClick={() => void doAdd()}
                          className="flex items-center gap-2 rounded-lg bg-brand-btn px-4 py-2 text-sm text-white disabled:opacity-50"
                        >
                          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                          {t.yesAdd}
                        </button>
                        <button
                          onClick={() => setSelected(null)}
                          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
          {chosen ? t.codeHint.replace('{code}', chosen.code) : t.codeHintGeneric}
        </div>
      </div>
    </div>
  );
}
