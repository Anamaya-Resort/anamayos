'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Check, Palette, Type, Layout, Sparkles } from 'lucide-react';
import {
  DEFAULT_BRANDING, COLOR_LABELS, COLOR_KEY_TO_CSS_VAR,
  type OrgBranding, type BrandingColors,
} from '@/config/branding-defaults';
import { FONT_FAMILIES } from '@/modules/room-builder/types';

// ── Color Picker Row ──
function ColorRow({ label, lightValue, darkValue, onLightChange, onDarkChange, defaultLight, defaultDark }: {
  label: string;
  lightValue: string;
  darkValue: string;
  onLightChange: (v: string) => void;
  onDarkChange: (v: string) => void;
  defaultLight: string;
  defaultDark: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="color" value={lightValue} onChange={(e) => onLightChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer" title="Light mode" />
        <input type="text" value={lightValue} onChange={(e) => onLightChange(e.target.value)}
          className="w-20 text-xs font-mono border rounded px-1.5 py-0.5" />
        {lightValue !== defaultLight && (
          <button onClick={() => onLightChange(defaultLight)} className="text-muted-foreground hover:text-foreground" title="Reset">
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input type="color" value={darkValue} onChange={(e) => onDarkChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer" title="Dark mode" />
        <input type="text" value={darkValue} onChange={(e) => onDarkChange(e.target.value)}
          className="w-20 text-xs font-mono border rounded px-1.5 py-0.5" />
        {darkValue !== defaultDark && (
          <button onClick={() => onDarkChange(defaultDark)} className="text-muted-foreground hover:text-foreground" title="Reset">
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Collapsible Section ──
function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
        {icon}
        {title}
        <span className="ml-auto text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 border-t pt-3">{children}</div>}
    </div>
  );
}

// ── Main Panel ──
export function BrandingPanel() {
  const [branding, setBranding] = useState<OrgBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load branding on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/branding');
        if (res.ok) {
          const { branding: b } = await res.json();
          setBranding(b);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-save with debounce
  const save = useCallback(async (data: OrgBranding) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/admin/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback((partial: Partial<OrgBranding>) => {
    setBranding((prev) => {
      const next = {
        ...prev,
        ...partial,
        light: { ...prev.light, ...(partial.light ?? {}) },
        dark: { ...prev.dark, ...(partial.dark ?? {}) },
      };

      // Apply live preview
      applyLivePreview(next);

      // Debounced save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(next), 800);

      return next;
    });
  }, [save]);

  const updateLightColor = useCallback((key: keyof BrandingColors, value: string) => {
    update({ light: { [key]: value } });
  }, [update]);

  const updateDarkColor = useCallback((key: keyof BrandingColors, value: string) => {
    update({ dark: { [key]: value } });
  }, [update]);

  const resetAll = useCallback(async () => {
    setBranding(DEFAULT_BRANDING);
    applyLivePreview(DEFAULT_BRANDING);
    setSaving(true);
    try {
      await fetch('/api/admin/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_BRANDING),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const brandColorKeys: (keyof BrandingColors)[] = ['brandBtn', 'brandBtnHover', 'brandBtnText', 'brandHighlight', 'brandDivider', 'brandSubtle', 'brandMuted'];
  const statusColorKeys: (keyof BrandingColors)[] = ['destructive', 'success', 'warning', 'info'];

  return (
    <div className="space-y-4">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Branding</h3>
          <p className="text-sm text-muted-foreground">Customize your organization&apos;s appearance. Changes preview live and auto-save.</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {saved && <span className="text-xs text-status-success flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>}
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset All
          </Button>
        </div>
      </div>

      {/* Preview swatch strip */}
      <div className="flex gap-1 rounded-lg overflow-hidden border h-8">
        {brandColorKeys.map((key) => (
          <div key={key} className="flex-1" style={{ backgroundColor: branding.light[key] }} title={COLOR_LABELS[key]} />
        ))}
      </div>

      {/* Sections */}
      <Section title="Brand Colors" icon={<Palette className="h-4 w-4" />} defaultOpen>
        <div className="mb-2 flex gap-3">
          <span className="w-28" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-[130px]">Light Mode</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Dark Mode</span>
        </div>
        {brandColorKeys.map((key) => (
          <ColorRow key={key}
            label={COLOR_LABELS[key]}
            lightValue={branding.light[key] ?? DEFAULT_BRANDING.light[key]!}
            darkValue={branding.dark[key] ?? DEFAULT_BRANDING.dark[key]!}
            defaultLight={DEFAULT_BRANDING.light[key]!}
            defaultDark={DEFAULT_BRANDING.dark[key]!}
            onLightChange={(v) => updateLightColor(key, v)}
            onDarkChange={(v) => updateDarkColor(key, v)}
          />
        ))}
      </Section>

      <Section title="Status Colors" icon={<Palette className="h-4 w-4" />}>
        <div className="mb-2 flex gap-3">
          <span className="w-28" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-[130px]">Light Mode</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Dark Mode</span>
        </div>
        {statusColorKeys.map((key) => (
          <ColorRow key={key}
            label={COLOR_LABELS[key]}
            lightValue={branding.light[key] ?? DEFAULT_BRANDING.light[key]!}
            darkValue={branding.dark[key] ?? DEFAULT_BRANDING.dark[key]!}
            defaultLight={DEFAULT_BRANDING.light[key]!}
            defaultDark={DEFAULT_BRANDING.dark[key]!}
            onLightChange={(v) => updateLightColor(key, v)}
            onDarkChange={(v) => updateDarkColor(key, v)}
          />
        ))}
      </Section>

      <Section title="Typography" icon={<Type className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Heading Font</label>
            <select value={branding.fontHeading ?? 'Inter'}
              onChange={(e) => update({ fontHeading: e.target.value })}
              className="border rounded px-2 py-1 text-sm flex-1">
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Body Font</label>
            <select value={branding.fontBody ?? 'Inter'}
              onChange={(e) => update({ fontBody: e.target.value })}
              className="border rounded px-2 py-1 text-sm flex-1">
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="mt-3 p-3 border rounded-lg">
            <p className="text-lg font-semibold" style={{ fontFamily: branding.fontHeading }}>Heading Preview</p>
            <p className="text-sm" style={{ fontFamily: branding.fontBody }}>Body text preview — the quick brown fox jumps over the lazy dog.</p>
          </div>
        </div>
      </Section>

      <Section title="Layout" icon={<Layout className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Corner Radius</label>
            <input type="range" min={0} max={20} step={1} value={branding.radius ?? 5}
              onChange={(e) => update({ radius: Number(e.target.value) })}
              className="flex-1" />
            <span className="text-xs font-mono w-10 text-right">{branding.radius ?? 5}px</span>
          </div>
          <div className="flex gap-3 mt-2">
            <div className="border p-3 flex-1" style={{ borderRadius: branding.radius ?? 5 }}>
              <p className="text-xs text-muted-foreground">Card preview</p>
            </div>
            <Button size="sm" style={{ borderRadius: branding.radius ?? 5 }}>Button</Button>
          </div>
        </div>
      </Section>

      <Section title="Button Effects" icon={<Sparkles className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Effect Strength</label>
            <input type="range" min={0} max={1} step={0.05} value={branding.btnFxStrength ?? 0.4}
              onChange={(e) => update({ btnFxStrength: Number(e.target.value) })}
              className="flex-1" />
            <span className="text-xs font-mono w-10 text-right">{((branding.btnFxStrength ?? 0.4) * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Effect Speed</label>
            <input type="range" min={0.5} max={2} step={0.1} value={branding.btnFxSpeed ?? 1}
              onChange={(e) => update({ btnFxSpeed: Number(e.target.value) })}
              className="flex-1" />
            <span className="text-xs font-mono w-10 text-right">{(branding.btnFxSpeed ?? 1).toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Click Sound</label>
            <button
              onClick={() => update({ btnFxSoundEnabled: !(branding.btnFxSoundEnabled ?? true) })}
              className={`w-10 h-5 rounded-full transition-colors ${branding.btnFxSoundEnabled !== false ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${branding.btnFxSoundEnabled !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-muted-foreground">{branding.btnFxSoundEnabled !== false ? 'On' : 'Off'}</span>
          </div>
          <div className="mt-2">
            <Button size="sm">Test Effect</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

/** Apply branding as live CSS variable overrides (for instant preview) */
function applyLivePreview(branding: OrgBranding) {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  const colors = isDark ? branding.dark : branding.light;

  for (const [key, cssVar] of Object.entries(COLOR_KEY_TO_CSS_VAR)) {
    const value = colors[key as keyof BrandingColors];
    if (value) root.style.setProperty(cssVar, value);
  }

  if (branding.radius !== undefined) root.style.setProperty('--radius', `${branding.radius}px`);
  if (branding.btnFxStrength !== undefined) root.style.setProperty('--btn-fx-strength', String(branding.btnFxStrength));
  if (branding.btnFxSpeed !== undefined) root.style.setProperty('--btn-fx-speed', String(branding.btnFxSpeed));
}
