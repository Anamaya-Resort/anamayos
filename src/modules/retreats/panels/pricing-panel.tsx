'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { RetreatData } from '../retreat-editor';

interface Tier { name: string; price: number | string; cutoff_date: string; spaces_total: number | string; description: string; }

interface Props { retreat: RetreatData; onChange: (partial: Record<string, unknown>) => void; retreatId: string; }

export function PricingPanel({ retreat, onChange, retreatId }: Props) {
  const pricingModel = (retreat.pricing_model as string) ?? 'fixed';
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/retreat-pricing?retreatId=${retreatId}`);
      const data = await res.json();
      setTiers((data.tiers ?? []).map((t: Record<string, unknown>) => ({
        name: t.name ?? '', price: t.price ?? '', cutoff_date: t.cutoff_date ?? '',
        spaces_total: t.spaces_total ?? '', description: t.description ?? '',
      })));
      setLoaded(true);
    })();
  }, [retreatId]);

  const saveTiers = useCallback(async (t: Tier[]) => {
    await fetch('/api/admin/retreat-pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retreat_id: retreatId, tiers: t }),
    });
  }, [retreatId]);

  const updateTiers = (next: Tier[]) => {
    setTiers(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveTiers(next), 500);
  };

  const isPrivate = retreat.is_private_retreat === true;

  return (
    <div className="space-y-3">
        {/* Pricing model */}
        <div className="flex gap-4">
          {['fixed', 'tiered', 'dynamic_plus'].map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="pricing_model" value={m} checked={pricingModel === m}
                onChange={() => onChange({ pricing_model: m })} />
              {m === 'fixed' ? 'Fixed' : m === 'tiered' ? 'Tiered' : 'Dynamic+ (Bonding Curve)'}
            </label>
          ))}
        </div>

        {/* Deposit */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Deposit %</label>
          <input type="number" value={(retreat.deposit_percentage as number) ?? 50} min={1} max={100}
            disabled={!isPrivate}
            onChange={(e) => onChange({ deposit_percentage: Number(e.target.value) })}
            className="w-20 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50" />
          {!isPrivate && <span className="text-[10px] text-muted-foreground">Fixed at 50% for non-private retreats</span>}
        </div>

        {/* Tiered pricing */}
        {pricingModel === 'tiered' && loaded && (
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className="flex gap-2 items-start rounded border bg-muted/20 p-2.5">
                <input value={tier.name} onChange={(e) => { const n = [...tiers]; n[i] = { ...tier, name: e.target.value }; updateTiers(n); }}
                  placeholder="Tier name" className="flex-1 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                <input type="number" value={tier.price} onChange={(e) => { const n = [...tiers]; n[i] = { ...tier, price: e.target.value }; updateTiers(n); }}
                  placeholder="Price" className="w-24 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                <input type="date" value={tier.cutoff_date} onChange={(e) => { const n = [...tiers]; n[i] = { ...tier, cutoff_date: e.target.value }; updateTiers(n); }}
                  className="w-36 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                <input type="number" value={tier.spaces_total} onChange={(e) => { const n = [...tiers]; n[i] = { ...tier, spaces_total: e.target.value }; updateTiers(n); }}
                  placeholder="Spots" className="w-20 rounded border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => updateTiers(tiers.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
            {tiers.length < 3 && (
              <Button size="sm" variant="outline" onClick={() => updateTiers([...tiers, { name: '', price: '', cutoff_date: '', spaces_total: '', description: '' }])} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Tier
              </Button>
            )}
          </div>
        )}

        {/* Dynamic+ bonding curve */}
        {pricingModel === 'dynamic_plus' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Start Price (first booking)</label>
                <input type="number" value={(retreat.curve_start_price as number) ?? ''} min={0}
                  onChange={(e) => onChange({ curve_start_price: e.target.value ? Number(e.target.value) : null })}
                  className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">End Price (when full)</label>
                <input type="number" value={(retreat.curve_end_price as number) ?? ''} min={0}
                  onChange={(e) => onChange({ curve_end_price: e.target.value ? Number(e.target.value) : null })}
                  className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Price increases linearly from ${(retreat.curve_start_price as number) ?? '?'} to ${(retreat.curve_end_price as number) ?? '?'} as spots fill.
              Requires max capacity to be set.
            </p>
          </div>
        )}

        {/* Add-ons toggle */}
        <label className="flex items-center gap-2 text-sm pt-2 border-t">
          <input type="checkbox" checked={retreat.addons_enabled !== false}
            onChange={(e) => onChange({ addons_enabled: e.target.checked })} className="rounded border" />
          Enable add-ons for this retreat
        </label>
    </div>
  );
}
