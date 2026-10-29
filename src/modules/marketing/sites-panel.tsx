'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarketingSite } from './types';
import type { TranslationKeys } from '@/i18n/en';

type Draft = {
  domain: string;
  label: string;
  ga4_property_id: string;
  ga4_hostname: string;
  gsc_property: string;
  gsc_page_filter: string;
};

const BLANK: Draft = {
  domain: '', label: '', ga4_property_id: '', ga4_hostname: '',
  gsc_property: '', gsc_page_filter: '',
};

/**
 * Tracked sites, inside the gear.
 *
 * Adding a subdomain is prefilled from the primary site, because in practice
 * a subdomain shares its parent's GA4 property and Search Console domain
 * property and only needs the two filters set. Typing the domain fills both
 * filters automatically, so the common case is one field.
 */
export function SitesSection({ dict }: { dict: TranslationKeys }) {
  const d = dict.dash.sites;
  const [sites, setSites] = useState<MarketingSite[]>([]);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketing/sites');
      if (!res.ok) return;
      const json = await res.json();
      setSites(json.sites ?? []);
    } catch {
      // Listing failed; the form still works.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const primary = sites.find((s) => s.is_primary);

  /** Typing a domain fills the inherited fields, which the user can still edit. */
  function setDomain(value: string) {
    setDraft((prev) => {
      const next = { ...prev, domain: value };
      const host = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (primary) {
        if (!prev.ga4_property_id) next.ga4_property_id = primary.ga4_property_id ?? '';
        if (!prev.gsc_property) next.gsc_property = primary.gsc_property ?? '';
      }
      // Filters track the domain while the user has not overridden them.
      if (!prev.ga4_hostname || prev.ga4_hostname === hostOf(prev.domain)) next.ga4_hostname = host;
      if (!prev.gsc_page_filter || prev.gsc_page_filter === hostOf(prev.domain)) next.gsc_page_filter = host;
      return next;
    });
  }

  async function save() {
    if (!draft.domain.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/marketing/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? d.saveFailed);
        return;
      }
      setDraft(BLANK);
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/sites?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? d.saveFailed);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof Draft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-1.5">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="font-heading text-sm font-semibold">{d.title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{d.hint}</p>

      {sites.map((s) => (
        <div key={s.id} className="flex items-start justify-between gap-2 rounded-lg border border-border px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm">
              {s.domain}
              {s.is_primary && (
                <span className="ml-2 rounded-full bg-brand-highlight/20 px-1.5 py-0.5 text-[10px] uppercase text-foreground">
                  {d.primary}
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {s.ga4_property_id ? `GA4 ${s.ga4_property_id}` : d.noGa4}
              {' · '}
              {s.gsc_property ? d.gscOn : d.noGsc}
            </p>
          </div>
          {!s.is_primary && (
            <Button type="button" variant="ghost" size="sm" disabled={busy}
              aria-label={d.remove} onClick={() => remove(s.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!open ? (
        <Button type="button" variant="outline" size="sm" className="w-full"
          onClick={() => setOpen(true)}>
          {d.add}
        </Button>
      ) : (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <div className="space-y-1">
            <Label htmlFor="site-domain" className="text-xs">{d.domain}</Label>
            <Input id="site-domain" value={draft.domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="cookbook.anamaya.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="site-label" className="text-xs">{d.label}</Label>
            <Input id="site-label" value={draft.label}
              onChange={(e) => set('label')(e.target.value)}
              placeholder={d.labelPlaceholder} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="site-ga4" className="text-xs">{d.ga4Property}</Label>
              <Input id="site-ga4" value={draft.ga4_property_id}
                onChange={(e) => set('ga4_property_id')(e.target.value)} placeholder="371232847" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="site-ga4-host" className="text-xs">{d.ga4Hostname}</Label>
              <Input id="site-ga4-host" value={draft.ga4_hostname}
                onChange={(e) => set('ga4_hostname')(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="site-gsc" className="text-xs">{d.gscProperty}</Label>
              <Input id="site-gsc" value={draft.gsc_property}
                onChange={(e) => set('gsc_property')(e.target.value)}
                placeholder="sc-domain:anamaya.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="site-gsc-filter" className="text-xs">{d.gscFilter}</Label>
              <Input id="site-gsc-filter" value={draft.gsc_page_filter}
                onChange={(e) => set('gsc_page_filter')(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">{d.inheritNote}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" disabled={busy || !draft.domain.trim()}
              onClick={save}>
              {d.save}
            </Button>
            <Button type="button" size="sm" variant="ghost"
              onClick={() => { setOpen(false); setDraft(BLANK); setError(null); }}>
              {d.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function hostOf(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}
