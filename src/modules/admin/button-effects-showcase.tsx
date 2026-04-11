'use client';

import { Button } from '@/components/ui/button';

const EFFECTS = [
  {
    code: 'BFX-00',
    name: 'Default',
    desc: 'Standard brand glow — applied to all buttons automatically',
    className: '',
    variant: 'default' as const,
  },
  {
    code: 'BFX-01',
    name: 'Subtle',
    desc: 'Low intensity glow for secondary/outline buttons',
    className: 'ao-btn-fx--subtle',
    variant: 'outline' as const,
  },
  {
    code: 'BFX-02',
    name: 'Strong',
    desc: 'High intensity glow for primary CTAs',
    className: 'ao-btn-fx--strong',
    variant: 'default' as const,
  },
  {
    code: 'BFX-03',
    name: 'Success',
    desc: 'Green glow for confirm/approve/save actions',
    className: 'ao-btn-fx--success',
    variant: 'default' as const,
  },
  {
    code: 'BFX-04',
    name: 'Info',
    desc: 'Blue glow for informational actions',
    className: 'ao-btn-fx--info',
    variant: 'outline' as const,
  },
  {
    code: 'BFX-05',
    name: 'Danger',
    desc: 'Red glow for destructive/cancel actions',
    className: 'ao-btn-fx--danger',
    variant: 'outline' as const,
  },
  {
    code: 'BFX-06',
    name: 'Fast',
    desc: 'Faster pulse speed (1.5x)',
    className: 'ao-btn-fx--fast',
    variant: 'default' as const,
  },
  {
    code: 'BFX-07',
    name: 'Slow',
    desc: 'Slower, calmer pulse (0.6x)',
    className: 'ao-btn-fx--slow',
    variant: 'default' as const,
  },
  {
    code: 'BFX-08',
    name: 'Strong + Fast',
    desc: 'Combined: high intensity + fast pulse',
    className: 'ao-btn-fx--strong ao-btn-fx--fast',
    variant: 'default' as const,
  },
  {
    code: 'BFX-09',
    name: 'Strong + Slow',
    desc: 'Combined: high intensity + slow pulse (login/hero)',
    className: 'ao-btn-fx--strong ao-btn-fx--slow',
    variant: 'default' as const,
  },
  {
    code: 'BFX-OFF',
    name: 'No Effects',
    desc: 'Disable all effects with data-no-fx',
    className: '',
    variant: 'outline' as const,
    noFx: true,
  },
];

const CUSTOM_EXAMPLES = [
  {
    code: 'BFX-C1',
    name: 'Gold Glow',
    desc: 'Custom color via CSS variable',
    style: { '--btn-fx-color-1': '#D4AF37', '--btn-fx-strength': '0.6' },
  },
  {
    code: 'BFX-C2',
    name: 'Purple Glow',
    desc: 'Custom purple with high strength',
    style: { '--btn-fx-color-1': '#8B5CF6', '--btn-fx-color-2': '#A78BFA', '--btn-fx-strength': '0.7' },
  },
  {
    code: 'BFX-C3',
    name: 'Turquoise',
    desc: 'Anamaya turquoise accent',
    style: { '--btn-fx-color-1': '#9CB5B1', '--btn-fx-color-2': '#A0BF52', '--btn-fx-strength': '0.5' },
  },
];

export function ButtonEffectsShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Preset Effects</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Hover over each button to see the glow. Click for the burst + sound. Reference by code when requesting effects.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {EFFECTS.map((fx) => (
            <div key={fx.code} className="flex flex-col items-center gap-2 p-3 rounded-md border border-border/50">
              <code className="text-[10px] font-bold text-primary">{fx.code}</code>
              <Button
                variant={fx.variant}
                size="sm"
                className={fx.className}
                {...(fx.noFx ? { 'data-no-fx': '' } : {})}
              >
                {fx.name}
              </Button>
              <p className="text-[9px] text-muted-foreground text-center leading-tight">{fx.desc}</p>
              {fx.className && (
                <code className="text-[8px] text-muted-foreground/60 bg-muted px-1 rounded">{fx.className}</code>
              )}
              {fx.noFx && (
                <code className="text-[8px] text-muted-foreground/60 bg-muted px-1 rounded">data-no-fx</code>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Custom Color Examples</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Pass --btn-fx-color-1/2/3 and --btn-fx-strength as CSS variables on any button.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {CUSTOM_EXAMPLES.map((fx) => (
            <div key={fx.code} className="flex flex-col items-center gap-2 p-3 rounded-md border border-border/50">
              <code className="text-[10px] font-bold text-primary">{fx.code}</code>
              <Button size="sm" style={fx.style as React.CSSProperties}>
                {fx.name}
              </Button>
              <p className="text-[9px] text-muted-foreground text-center">{fx.desc}</p>
              <code className="text-[8px] text-muted-foreground/60 bg-muted px-1 rounded break-all text-center">
                {Object.entries(fx.style).map(([k, v]) => `${k}: ${v}`).join('; ')}
              </code>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Quick Reference</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium">Code</th>
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Class</th>
                <th className="pb-2 font-medium">Use For</th>
              </tr>
            </thead>
            <tbody>
              {EFFECTS.map((fx) => (
                <tr key={fx.code} className="border-b border-border/30">
                  <td className="py-1.5 pr-4 font-mono font-bold text-primary">{fx.code}</td>
                  <td className="py-1.5 pr-4">{fx.name}</td>
                  <td className="py-1.5 pr-4 font-mono text-muted-foreground">{fx.className || (fx.noFx ? 'data-no-fx' : '(default)')}</td>
                  <td className="py-1.5 text-muted-foreground">{fx.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
