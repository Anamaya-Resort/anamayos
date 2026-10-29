'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlatformLogo } from './platform-logos';
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

export function ConnectionsButton({
  platforms, dict,
}: {
  platforms: MarketingPlatform[]; dict: TranslationKeys;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, boolean>>({});

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
      setSavedAt((s) => ({ ...s, [id]: true }));
      setValues((v) => ({ ...v, [id]: '' }));
    } finally {
      setSaving(null);
    }
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
          {platforms.map((p) => (
            <div key={p.key} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-1.5">
                <PlatformLogo slug={p.logo_slug} />
                <span className="font-heading text-sm font-semibold">{p.name}</span>
              </div>
              {(FIELDS[p.key] ?? []).map((f) => {
                const id = `${p.key}.${f.key}`;
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
                        placeholder={savedAt[id] ? dict.dash.saved : ''}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving === id || !(values[id] ?? '').trim()}
                        onClick={() => save(p.key, f.key, f.secret)}
                      >
                        {dict.dash.save}
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
