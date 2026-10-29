'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlatformLogo } from './platform-logos';
import { SitesSection } from './sites-panel';
import type { MarketingPlatform } from './types';
import type { TranslationKeys } from '@/i18n/en';

/**
 * The gear. Public identifiers (pixel ids, ad account ids) are saved as
 * settings and can be read back. Anything marked secret is write-only:
 * it goes to the server and only its last four characters ever come
 * back, so a token can be confirmed but never re-read from the browser.
 */
const FIELDS: Record<string, { key: string; label: string; secret: boolean }[]> = {
  instagram: [
    { key: 'ad_account_id', label: 'Meta Ad Account ID', secret: false },
    { key: 'pixel_id', label: 'Meta Pixel ID', secret: false },
    { key: 'access_token', label: 'Meta access token', secret: true },
    { key: 'capi_token', label: 'Conversions API token', secret: true },
  ],
  facebook: [
    { key: 'ad_account_id', label: 'Meta Ad Account ID', secret: false },
    { key: 'page_id', label: 'Facebook Page ID', secret: false },
    { key: 'access_token', label: 'Meta access token', secret: true },
  ],
  tiktok: [
    { key: 'advertiser_id', label: 'TikTok Advertiser ID', secret: false },
    { key: 'pixel_id', label: 'TikTok Pixel ID', secret: false },
    { key: 'access_token', label: 'TikTok access token', secret: true },
  ],
  google: [
    { key: 'customer_id', label: 'Google Ads Customer ID', secret: false },
    { key: 'conversion_id', label: 'Conversion ID (AW-)', secret: false },
    { key: 'developer_token', label: 'Developer token', secret: true },
    { key: 'refresh_token', label: 'OAuth refresh token', secret: true },
  ],
};

type Stored = {
  /** `platform.key` → the saved value, for non-secret identifiers. */
  settings: Record<string, string>;
  /** `platform.key` → the last four characters, for secrets. */
  secrets: Record<string, string>;
};

export function ConnectionsButton({
  platforms, dict,
}: {
  platforms: MarketingPlatform[]; dict: TranslationKeys;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [stored, setStored] = useState<Stored>({ settings: {}, secrets: {} });

  /** Reads back what is already saved so each field shows its own state. */
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketing/connections');
      if (!res.ok) return;
      const json = await res.json();
      const settings: Record<string, string> = {};
      for (const r of json.settings ?? []) {
        settings[`${r.platform_key}.${r.setting_key}`] = r.setting_value ?? '';
      }
      const secrets: Record<string, string> = {};
      for (const r of json.secrets ?? []) {
        secrets[`${r.platform_key}.${r.secret_key}`] = r.last4 ?? '';
      }
      setStored({ settings, secrets });
    } catch {
      // Nothing saved yet, or the read failed. The form still works.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(platform: string, key: string, secret: boolean) {
    const id = `${platform}.${key}`;
    const value = values[id] ?? '';
    if (!value.trim()) return;
    setSaving(id);
    try {
      await fetch('/api/admin/marketing/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_key: platform, key, value, secret }),
      });
      setValues((v) => ({ ...v, [id]: '' }));
      await load();
    } finally {
      setSaving(null);
    }
  }

  /** True when every field this platform needs has something saved. */
  function platformReady(key: string): boolean {
    const fields = FIELDS[key] ?? [];
    if (fields.length === 0) return false;
    return fields.every((f) =>
      f.secret ? !!stored.secrets[`${key}.${f.key}`] : !!stored.settings[`${key}.${f.key}`]);
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" aria-label={dict.dash.settings}>
            <Settings className="h-4 w-4" />
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{dict.dash.settings}</SheetTitle>
        </SheetHeader>
        <p className="px-4 text-xs text-muted-foreground">{dict.dash.settingsHint}</p>

        <div className="space-y-6 p-4">
          <SitesSection dict={dict} />

          {platforms.map((p) => (
            <div key={p.key} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-1.5">
                <PlatformLogo slug={p.logo_slug} />
                <span className="font-heading text-sm font-semibold">{p.name}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
                    platformReady(p.key)
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {platformReady(p.key) ? dict.dash.connected : dict.dash.notConnected}
                </span>
              </div>
              {(FIELDS[p.key] ?? []).map((f) => {
                const id = `${p.key}.${f.key}`;
                const savedSetting = stored.settings[id];
                const savedLast4 = stored.secrets[id];
                const isSaved = f.secret ? !!savedLast4 : !!savedSetting;
                return (
                  <div key={id} className="space-y-1">
                    <Label htmlFor={id} className="text-xs">
                      {f.label}
                      {f.secret && <span className="ml-1 text-muted-foreground">(secret)</span>}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={id}
                        type={f.secret ? 'password' : 'text'}
                        autoComplete="off"
                        value={values[id] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
                        placeholder={
                          f.secret
                            ? (savedLast4 ? `••••${savedLast4}` : '')
                            : (savedSetting ?? '')
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving === id || !(values[id] ?? '').trim()}
                        onClick={() => save(p.key, f.key, f.secret)}
                      >
                        {isSaved ? dict.dash.replace : dict.dash.save}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
