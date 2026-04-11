'use client';

import { Button } from '@/components/ui/button';

const EFFECTS = [
  {
    name: 'Default',
    desc: 'Standard brand glow — applied to all buttons by default',
    className: '',
    variant: 'default' as const,
  },
  {
    name: 'Subtle',
    desc: 'Low intensity glow for secondary/outline buttons',
    className: 'ao-btn-fx--subtle',
    variant: 'outline' as const,
  },
  {
    name: 'Strong',
    desc: 'High intensity glow for primary CTAs',
    className: 'ao-btn-fx--strong',
    variant: 'default' as const,
  },
  {
    name: 'Success',
    desc: 'Green glow for confirm/approve actions',
    className: 'ao-btn-fx--success',
    variant: 'default' as const,
  },
  {
    name: 'Info',
    desc: 'Blue glow for informational actions',
    className: 'ao-btn-fx--info',
    variant: 'outline' as const,
  },
  {
    name: 'Danger',
    desc: 'Red glow for destructive/cancel actions',
    className: 'ao-btn-fx--danger',
    variant: 'outline' as const,
  },
  {
    name: 'Fast',
    desc: 'Faster pulse speed (1.5x)',
    className: 'ao-btn-fx--fast',
    variant: 'default' as const,
  },
  {
    name: 'Slow',
    desc: 'Slower, calmer pulse (0.6x)',
    className: 'ao-btn-fx--slow',
    variant: 'default' as const,
  },
  {
    name: 'Strong + Fast',
    desc: 'Combined: high intensity + fast pulse',
    className: 'ao-btn-fx--strong ao-btn-fx--fast',
    variant: 'default' as const,
  },
  {
    name: 'No Effects',
    desc: 'Disable all effects with data-no-fx',
    className: '',
    variant: 'outline' as const,
    noFx: true,
  },
];

const CUSTOM_EXAMPLES = [
  {
    name: 'Gold Glow',
    desc: 'Custom color via CSS variable',
    style: { '--btn-fx-color-1': '#D4AF37', '--btn-fx-strength': '0.6' },
  },
  {
    name: 'Purple Glow',
    desc: 'Custom purple with high strength',
    style: { '--btn-fx-color-1': '#8B5CF6', '--btn-fx-color-2': '#A78BFA', '--btn-fx-strength': '0.7' },
  },
  {
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
          Hover over each button to see the glow effect. Click to see the burst + sound.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {EFFECTS.map((fx) => (
            <div key={fx.name} className="flex flex-col items-center gap-2 p-3 rounded-md border border-border/50">
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
            <div key={fx.name} className="flex flex-col items-center gap-2 p-3 rounded-md border border-border/50">
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
        <h3 className="text-sm font-semibold mb-3">Usage</h3>
        <div className="text-xs text-muted-foreground space-y-2 bg-muted p-3 rounded-md font-mono">
          <p>{'// Preset class'}</p>
          <p>{'<Button className="ao-btn-fx--strong">Save</Button>'}</p>
          <p className="mt-2">{'// Custom colors + strength'}</p>
          <p>{'<Button style={{ "--btn-fx-color-1": "#gold", "--btn-fx-strength": "0.8" }}>'}</p>
          <p className="mt-2">{'// Disable effects'}</p>
          <p>{'<Button data-no-fx>Plain</Button>'}</p>
        </div>
      </div>
    </div>
  );
}
