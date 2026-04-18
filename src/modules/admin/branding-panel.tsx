'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, RotateCcw, Palette, Type, Layout, Sparkles, Play, X, Image as ImageIcon } from 'lucide-react';
import { DEFAULT_BRANDING, COLOR_LABELS, BLEND_MODES, type OrgBranding, type BrandingColors, type BlendMode } from '@/config/branding-defaults';
import { FONT_FAMILIES } from '@/modules/room-builder/types';
import { useBrandingTestMode } from '@/lib/branding-test-mode';

// ── Color Swatch (read-only) ──
function ColorSwatch({ label, lightValue, darkValue }: { label: string; lightValue: string; darkValue: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[11px] text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="w-6 h-6 rounded border" style={{ backgroundColor: lightValue }} title={`Light: ${lightValue}`} />
      <div className="w-6 h-6 rounded border" style={{ backgroundColor: darkValue }} title={`Dark: ${darkValue}`} />
    </div>
  );
}

// ── Color Picker Row (editable) ──
function ColorRow({ label, lightValue, darkValue, onLightChange, onDarkChange, defaultLight, defaultDark }: {
  label: string; lightValue: string; darkValue: string;
  onLightChange: (v: string) => void; onDarkChange: (v: string) => void;
  defaultLight: string; defaultDark: string;
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
        {icon}{title}
        <span className="ml-auto text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 border-t pt-3">{children}</div>}
    </div>
  );
}

const BRAND_COLOR_KEYS: (keyof BrandingColors)[] = ['brandBtn', 'brandBtnHover', 'brandBtnText', 'brandHighlight', 'brandDivider', 'brandSubtle', 'brandMuted'];
const STATUS_COLOR_KEYS: (keyof BrandingColors)[] = ['destructive', 'success', 'warning', 'info'];

// ── ACTIVE Panel (read-only) ──
function ActivePanel({ branding }: { branding: OrgBranding }) {
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <h4 className="text-sm font-semibold">Active</h4>
      </div>

      {/* Color swatches */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Brand Colors</p>
        <div className="flex gap-0.5 rounded overflow-hidden border h-5 mb-2">
          {BRAND_COLOR_KEYS.map((key) => (
            <div key={key} className="flex-1" style={{ backgroundColor: branding.light[key] }} title={COLOR_LABELS[key]} />
          ))}
        </div>
        {BRAND_COLOR_KEYS.map((key) => (
          <ColorSwatch key={key} label={COLOR_LABELS[key]} lightValue={branding.light[key] ?? ''} darkValue={branding.dark[key] ?? ''} />
        ))}
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Status Colors</p>
        {STATUS_COLOR_KEYS.map((key) => (
          <ColorSwatch key={key} label={COLOR_LABELS[key]} lightValue={branding.light[key] ?? ''} darkValue={branding.dark[key] ?? ''} />
        ))}
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Typography & Layout</p>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Heading: <span className="text-foreground font-medium">{branding.fontHeading ?? 'Inter'}</span></p>
          <p>Body: <span className="text-foreground font-medium">{branding.fontBody ?? 'Inter'}</span></p>
          <p>Radius: <span className="text-foreground font-medium">{branding.radius ?? 5}px</span></p>
        </div>
      </div>
    </div>
  );
}

// ── TEST MODE Panel (editable) ──
function TestModePanel({ branding, onUpdate, onPromote, onDiscard, onReset, isActive }: {
  branding: OrgBranding | null; onUpdate: (partial: Partial<OrgBranding>) => void;
  onPromote: () => Promise<void>; onDiscard: () => Promise<void>; onReset: () => Promise<void>; isActive: boolean;
}) {
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoting, setPromoting] = useState(false);

  if (!isActive || !branding) return null;

  const updateLight = (key: keyof BrandingColors, value: string) => onUpdate({ light: { [key]: value } });
  const updateDark = (key: keyof BrandingColors, value: string) => onUpdate({ dark: { [key]: value } });

  return (
    <div className="border-2 border-blue-400 rounded-lg p-4 space-y-4 bg-blue-50/30 dark:bg-blue-950/20">
      {/* Header with actions */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Test Mode</h4>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={onReset} className="text-xs gap-1" title="Reset test to current live values">
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
          <Button size="sm" variant="outline" onClick={onDiscard} className="text-xs gap-1">
            <X className="h-3 w-3" /> Discard
          </Button>
          <Button size="sm" onClick={() => setShowPromoteDialog(true)} className="text-xs gap-1">
            <Play className="h-3 w-3" /> Go Live
          </Button>
        </div>
      </div>

      {/* Color sections */}
      <Section title="Brand Colors" icon={<Palette className="h-4 w-4" />} defaultOpen>
        <div className="mb-2 flex gap-3">
          <span className="w-28" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-[130px]">Light</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Dark</span>
        </div>
        {BRAND_COLOR_KEYS.map((key) => (
          <ColorRow key={key} label={COLOR_LABELS[key]}
            lightValue={branding.light[key] ?? DEFAULT_BRANDING.light[key]!}
            darkValue={branding.dark[key] ?? DEFAULT_BRANDING.dark[key]!}
            defaultLight={DEFAULT_BRANDING.light[key]!} defaultDark={DEFAULT_BRANDING.dark[key]!}
            onLightChange={(v) => updateLight(key, v)} onDarkChange={(v) => updateDark(key, v)} />
        ))}
      </Section>

      <Section title="Status Colors" icon={<Palette className="h-4 w-4" />}>
        <div className="mb-2 flex gap-3">
          <span className="w-28" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-[130px]">Light</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Dark</span>
        </div>
        {STATUS_COLOR_KEYS.map((key) => (
          <ColorRow key={key} label={COLOR_LABELS[key]}
            lightValue={branding.light[key] ?? DEFAULT_BRANDING.light[key]!}
            darkValue={branding.dark[key] ?? DEFAULT_BRANDING.dark[key]!}
            defaultLight={DEFAULT_BRANDING.light[key]!} defaultDark={DEFAULT_BRANDING.dark[key]!}
            onLightChange={(v) => updateLight(key, v)} onDarkChange={(v) => updateDark(key, v)} />
        ))}
      </Section>

      <Section title="Typography" icon={<Type className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Heading Font</label>
            <select value={branding.fontHeading ?? 'Inter'}
              onChange={(e) => onUpdate({ fontHeading: e.target.value })}
              className="border rounded px-2 py-1 text-sm flex-1">
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Body Font</label>
            <select value={branding.fontBody ?? 'Inter'}
              onChange={(e) => onUpdate({ fontBody: e.target.value })}
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
              onChange={(e) => onUpdate({ radius: Number(e.target.value) })} className="flex-1" />
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
              onChange={(e) => onUpdate({ btnFxStrength: Number(e.target.value) })} className="flex-1" />
            <span className="text-xs font-mono w-10 text-right">{((branding.btnFxStrength ?? 0.4) * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Effect Speed</label>
            <input type="range" min={0.5} max={2} step={0.1} value={branding.btnFxSpeed ?? 1}
              onChange={(e) => onUpdate({ btnFxSpeed: Number(e.target.value) })} className="flex-1" />
            <span className="text-xs font-mono w-10 text-right">{(branding.btnFxSpeed ?? 1).toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Click Sound</label>
            <button onClick={() => onUpdate({ btnFxSoundEnabled: !(branding.btnFxSoundEnabled ?? true) })}
              className={`w-10 h-5 rounded-full transition-colors ${branding.btnFxSoundEnabled !== false ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${branding.btnFxSoundEnabled !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-muted-foreground">{branding.btnFxSoundEnabled !== false ? 'On' : 'Off'}</span>
          </div>
          <Button size="sm" className="mt-2">Test Effect</Button>
        </div>
      </Section>

      <Section title="Background" icon={<ImageIcon className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Color</label>
            <input type="color" value={branding.backgroundColor ?? '#ffffff'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="w-7 h-7 rounded border cursor-pointer" />
            <input type="text" value={branding.backgroundColor ?? '#ffffff'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="w-20 text-xs font-mono border rounded px-1.5 py-0.5" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Image URL</label>
            <input type="text" value={branding.backgroundImageUrl ?? ''}
              onChange={(e) => onUpdate({ backgroundImageUrl: e.target.value })}
              placeholder="https://... or upload later"
              className="flex-1 text-xs border rounded px-2 py-1" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Opacity</label>
            <input type="range" min={0} max={1} step={0.05} value={branding.backgroundOpacity ?? 1}
              onChange={(e) => onUpdate({ backgroundOpacity: Number(e.target.value) })}
              className="flex-1" />
            <span className="text-xs font-mono w-10 text-right">{((branding.backgroundOpacity ?? 1) * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-28">Blend Mode</label>
            <select value={branding.backgroundBlendMode ?? 'normal'}
              onChange={(e) => onUpdate({ backgroundBlendMode: e.target.value as BlendMode })}
              className="border rounded px-2 py-1 text-xs flex-1">
              {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {/* Preview */}
          <div className="h-16 rounded border overflow-hidden relative">
            <div className="absolute inset-0" style={{ backgroundColor: branding.backgroundColor ?? '#ffffff' }} />
            {branding.backgroundImageUrl && (
              <div className="absolute inset-0" style={{
                backgroundImage: `url(${branding.backgroundImageUrl})`,
                backgroundSize: '64px 64px', backgroundRepeat: 'repeat',
                opacity: branding.backgroundOpacity ?? 1,
                mixBlendMode: (branding.backgroundBlendMode ?? 'normal') as React.CSSProperties['mixBlendMode'],
              }} />
            )}
            <p className="relative text-xs text-center pt-6 text-muted-foreground">Background Preview</p>
          </div>
        </div>
      </Section>

      {/* Promote confirmation dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Go Live with Test Branding?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will apply your test branding as the live branding for your organization. All users will see these changes.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoteDialog(false)}>Cancel</Button>
            <Button disabled={promoting} onClick={async () => {
              setPromoting(true);
              await onPromote();
              setShowPromoteDialog(false);
              setPromoting(false);
            }}>
              {promoting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Panel ──
export function BrandingPanel() {
  const { isTestMode, liveBranding, testBranding, resetTest, enterTestMode, exitTestMode, promoteToLive, updateTest } = useBrandingTestMode();
  const [entering, setEntering] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Branding</h3>
        <p className="text-sm text-muted-foreground">
          {isTestMode
            ? 'Test mode active — changes preview live for you only. Click "Go Live" to apply for all users.'
            : 'View your active branding or start a test to experiment with changes.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ACTIVE panel — always visible */}
        <ActivePanel branding={liveBranding} />

        {/* TEST MODE panel */}
        {isTestMode ? (
          <TestModePanel branding={testBranding} onUpdate={updateTest}
            onPromote={promoteToLive} onDiscard={exitTestMode} onReset={resetTest} isActive />
        ) : (
          <div className="border rounded-lg p-4 flex flex-col items-center justify-center gap-3 min-h-[200px] bg-muted/10">
            <div className="text-center">
              <h4 className="text-sm font-semibold text-muted-foreground">Test Mode</h4>
              <p className="text-xs text-muted-foreground mt-1">Experiment with branding changes before going live.</p>
            </div>
            <Button onClick={async () => { setEntering(true); await enterTestMode(); setEntering(false); }}
              disabled={entering} className="gap-2">
              {entering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start Testing
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
