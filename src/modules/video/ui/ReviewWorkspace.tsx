'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Sparkles,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslationKeys } from '@/i18n/en';

type Detection = {
  label: string;
  kind: 'face' | 'object';
  role: 'primary' | 'secondary' | 'none';
  bbox: [number, number, number, number];
};
type Item = {
  id: string;
  file_name: string;
  image_url: string | null;
  color_temp: string | null;
  aesthetic_score: number | null;
  detections: Detection[];
  has_faces: boolean;
  review_status: string;
  use_permission: string;
  has_minor_faces: boolean | null;
  is_staff_only: boolean | null;
  notes: string;
  tags: { tag: string; source: string }[];
  summary: string;
  top_archetype: { name: string; score: number } | null;
};
type Counts = {
  needs_review: number;
  needs_consent: number;
  approved: number;
  rejected: number;
};
type Resp = {
  counts: Counts;
  items: Item[];
  total: number;
  offset: number;
  pageSize: number;
};

const TABS = [
  { id: 'needs_review', key: 'tabNeedsReview', countKey: 'needs_review' },
  { id: 'needs_consent', key: 'tabNeedsConsent', countKey: 'needs_consent' },
  { id: 'approved', key: 'tabApproved', countKey: 'approved' },
  { id: 'rejected', key: 'tabRejected', countKey: 'rejected' },
] as const;

const PERMS = [
  { id: 'unknown', key: 'permUnknown' },
  { id: 'do_not_use', key: 'permDoNotUse' },
  { id: 'internal_only', key: 'permInternalOnly' },
  { id: 'organic_social_ok', key: 'permOrganicSocialOk' },
  { id: 'ads_ok', key: 'permAdsOk' },
  { id: 'public_marketing_ok', key: 'permPublicMarketingOk' },
] as const;

export function ReviewWorkspace({ dict }: { dict: TranslationKeys }) {
  const t = dict.video.review;
  const [filter, setFilter] = useState('needs_review');
  const [data, setData] = useState<Resp | null>(null);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Per-asset edit state, reset whenever the current asset changes.
  const [perm, setPerm] = useState('unknown');
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [staffOnly, setStaffOnly] = useState(false);
  const [minor, setMinor] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);
  const current: Item | null = items[idx] ?? null;
  const lastId = useRef<string | null>(null);

  const load = useCallback(async (f: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/video/review?filter=${f}&offset=0`);
      if (!res.ok) return;
      const json: Resp = await res.json();
      setData(json);
      setIdx(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  // Hydrate edit state from the current asset.
  useEffect(() => {
    if (!current || current.id === lastId.current) return;
    lastId.current = current.id;
    setPerm(current.use_permission || 'unknown');
    setDropped(new Set());
    setAdded([]);
    setTagInput('');
    setNotes(current.notes || '');
    setStaffOnly(current.is_staff_only ?? false);
    setMinor(current.has_minor_faces ?? false);
  }, [current]);

  const finalTags = useMemo(
    () =>
      current
        ? [
            ...current.tags.map((x) => x.tag).filter((x) => !dropped.has(x)),
            ...added,
          ]
        : [],
    [current, dropped, added],
  );

  const save = useCallback(
    async (status: 'approved' | 'rejected') => {
      if (!current || saving) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/video/review/${current.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approval_status: status,
            use_permission: perm,
            has_recognizable_faces: current.has_faces || null,
            has_minor_faces: minor,
            is_staff_only: staffOnly,
            notes,
            tags: finalTags,
          }),
        });
        if (res.ok) await load(filter);
      } finally {
        setSaving(false);
      }
    },
    [current, saving, perm, minor, staffOnly, notes, finalTags, load, filter],
  );

  const bulk = useCallback(async () => {
    if (items.length === 0) return;
    const msg = t.applyConfirm.replace('{n}', String(items.length));
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/video/review/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_ids: items.map((i) => i.id),
          use_permission: perm,
        }),
      });
      if (res.ok) await load(filter);
    } finally {
      setSaving(false);
    }
  }, [items, perm, t.applyConfirm, load, filter]);

  const move = useCallback(
    (d: 1 | -1) => setIdx((i) => Math.min(items.length - 1, Math.max(0, i + d))),
    [items.length],
  );

  // Keyboard: arrows move, A approve, R reject (ignored while typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key.toLowerCase() === 'a') void save('approved');
      else if (e.key.toLowerCase() === 'r') void save('rejected');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, save]);

  const addTag = () => {
    const v = tagInput.trim();
    if (v && !finalTags.includes(v)) setAdded((a) => [...a, v]);
    setTagInput('');
  };
  const toggleTag = (tag: string) =>
    setDropped((s) => {
      const n = new Set(s);
      if (n.has(tag)) n.delete(tag);
      else n.add(tag);
      return n;
    });

  return (
    <div className="space-y-4">
      {/* Inbox tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tb) => (
          <Button
            key={tb.id}
            variant={filter === tb.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(tb.id)}
          >
            {t[tb.key]}
            {data && (
              <span className="ml-1.5 opacity-70">
                {data.counts[tb.countKey]}
              </span>
            )}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="flex h-80 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : !current ? (
        <Card className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Inbox className="h-6 w-6" />
          {t.empty}
        </Card>
      ) : (
        <Card className="p-4">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
            {/* Image + detections */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.image_url ?? ''}
                  alt={current.file_name}
                  className="block max-h-[56vh] w-auto rounded-lg"
                />
                {current.detections.map((d, i) => {
                  const [x, y, w, h] = d.bbox;
                  const isFace = d.kind === 'face';
                  return (
                    <div
                      key={i}
                      className={cn(
                        'absolute rounded',
                        isFace
                          ? 'border-2 border-brand-btn'
                          : 'border-2 border-brand-highlight',
                      )}
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        width: `${w * 100}%`,
                        height: `${h * 100}%`,
                      }}
                    >
                      <span
                        className={cn(
                          'absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-medium text-white',
                          isFace ? 'bg-brand-btn' : 'bg-brand-highlight',
                        )}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="max-w-xl text-center text-xs text-muted-foreground">
                {current.summary}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {idx + 1} {t.position} {data?.total ?? items.length}
                </span>
                {current.aesthetic_score != null && (
                  <span className="text-brand-highlight">
                    ★ {current.aesthetic_score.toFixed(1)}
                  </span>
                )}
                {current.top_archetype && (
                  <Badge className="bg-brand-btn text-white">
                    <Sparkles className="mr-1 h-3 w-3" />
                    {current.top_archetype.name}
                  </Badge>
                )}
              </div>
            </div>

            {/* Decision panel */}
            <div className="space-y-4">
              {current.has_faces && perm === 'unknown' && (
                <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning-foreground">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
                  <span>{t.facesBanner}</span>
                </div>
              )}

              <div>
                <div className="mb-1.5 text-xs font-medium">{t.permLabel}</div>
                <div className="flex flex-wrap gap-1.5">
                  {PERMS.map((p) => (
                    <Button
                      key={p.id}
                      variant={perm === p.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPerm(p.id)}
                    >
                      {t[p.key]}
                    </Button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={staffOnly}
                      onChange={(e) => setStaffOnly(e.target.checked)}
                    />
                    {t.staffOnly}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={minor}
                      onChange={(e) => setMinor(e.target.checked)}
                    />
                    {t.minorFaces}
                  </label>
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium">{t.tagsLabel}</div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {current.tags.map((x) => (
                    <button key={x.tag} onClick={() => toggleTag(x.tag)}>
                      <Badge
                        variant={dropped.has(x.tag) ? 'outline' : 'secondary'}
                        className={cn(
                          'cursor-pointer',
                          dropped.has(x.tag) && 'line-through opacity-50',
                        )}
                      >
                        {x.tag}
                      </Badge>
                    </button>
                  ))}
                  {added.map((tg) => (
                    <button
                      key={tg}
                      onClick={() => setAdded((a) => a.filter((y) => y !== tg))}
                    >
                      <Badge className="cursor-pointer bg-brand-highlight text-white">
                        {tg}
                      </Badge>
                    </button>
                  ))}
                </div>
                <Input
                  value={tagInput}
                  placeholder={t.addTagPlaceholder}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
              </div>

              <textarea
                value={notes}
                placeholder={t.notesPlaceholder}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                  disabled={saving}
                  onClick={() => save('approved')}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {t.approve}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={saving}
                  onClick={() => save('rejected')}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  {t.reject}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={idx === 0}
                    onClick={() => move(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t.prev}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={idx >= items.length - 1}
                    onClick={() => move(1)}
                  >
                    {t.next}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={bulk}
                >
                  {t.applyToView.replace('{n}', String(items.length))}
                </Button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                {t.keyboardHint}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
