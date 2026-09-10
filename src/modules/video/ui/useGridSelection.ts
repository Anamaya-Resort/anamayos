'use client';

import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Selection behaving the way every file manager has for thirty years.
 * There is nothing to invent here and users already know the rules:
 *
 *   click                 replace the selection with this one
 *   cmd/ctrl + click      toggle this one, keep the rest
 *   shift + click         select the range from the anchor to here
 *   cmd/ctrl + shift      add that range to the selection
 *   drag on empty space   marquee, selecting everything it touches
 *   cmd/ctrl + A          select all loaded
 *   Escape                clear
 *
 * Order is preserved, so a gallery ends up in the order things were
 * picked rather than in grid order.
 */
export type Rect = { x: number; y: number; w: number; h: number };

export function useGridSelection(ids: string[]) {
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const baseSelection = useRef<string[]>([]);

  const selectedSet = new Set(selected);

  const onItemClick = useCallback(
    (i: number, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      const id = ids[i];
      if (!id) return;
      const toggle = e.metaKey || e.ctrlKey;

      if (e.shiftKey && anchor !== null) {
        const [from, to] = anchor < i ? [anchor, i] : [i, anchor];
        const range = ids.slice(from, to + 1);
        setSelected((prev) => {
          if (!toggle) return range;
          const merged = [...prev];
          for (const r of range) if (!merged.includes(r)) merged.push(r);
          return merged;
        });
        return;
      }

      if (toggle) {
        setSelected((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
      } else {
        // A plain click replaces. Clicking the only selected item
        // again clears, which is what a desktop does.
        setSelected((prev) => (prev.length === 1 && prev[0] === id ? [] : [id]));
      }
      setAnchor(i);
    },
    [ids, anchor],
  );

  /** Right-click acts on the clicked item unless it is already in the selection. */
  const ensureSelected = useCallback(
    (i: number) => {
      const id = ids[i];
      if (!id) return;
      setSelected((prev) => (prev.includes(id) ? prev : [id]));
      setAnchor(i);
    },
    [ids],
  );

  const clear = useCallback(() => {
    setSelected([]);
    setAnchor(null);
  }, []);

  const selectAll = useCallback(() => setSelected([...ids]), [ids]);

  // ---- marquee -------------------------------------------------
  const onContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Starting on a tile means a click or a drag of that tile, not
      // a marquee.
      if ((e.target as HTMLElement).closest('[data-sel-idx]')) return;
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      const additive = e.metaKey || e.ctrlKey || e.shiftKey;
      dragStart.current = {
        x: e.clientX - box.left,
        y: e.clientY - box.top,
        additive,
      };
      baseSelection.current = additive ? selected : [];
      if (!additive) clear();
    },
    [selected, clear],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const move = (e: MouseEvent) => {
      const start = dragStart.current;
      const box = containerRef.current?.getBoundingClientRect();
      if (!start || !box) return;
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      const rect: Rect = {
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        w: Math.abs(x - start.x),
        h: Math.abs(y - start.y),
      };
      // A few pixels of slop, so a sloppy click is not a drag.
      if (rect.w < 4 && rect.h < 4) return;
      setMarquee(rect);

      const hits: string[] = [];
      const tiles = containerRef.current?.querySelectorAll('[data-sel-idx]') ?? [];
      tiles.forEach((el) => {
        const r = el.getBoundingClientRect();
        const left = r.left - box.left;
        const top = r.top - box.top;
        const intersects =
          left < rect.x + rect.w &&
          left + r.width > rect.x &&
          top < rect.y + rect.h &&
          top + r.height > rect.y;
        if (intersects) {
          const idx = Number((el as HTMLElement).dataset.selIdx);
          const id = ids[idx];
          if (id) hits.push(id);
        }
      });
      const merged = [...baseSelection.current];
      for (const h of hits) if (!merged.includes(h)) merged.push(h);
      setSelected(merged);
    };

    const up = () => {
      dragStart.current = null;
      setMarquee(null);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [ids]);

  // ---- keyboard ------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') clear();
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clear, selectAll]);

  return {
    selected,
    selectedSet,
    setSelected,
    onItemClick,
    ensureSelected,
    clear,
    selectAll,
    containerRef,
    onContainerMouseDown,
    marquee,
  };
}
