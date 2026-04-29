'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import type { WizardState } from './booking-wizard';

interface Addon {
  id: string;
  product_id: string;
  custom_price: number | null;
  product: {
    id: string;
    name: string;
    short_description: string | null;
    base_price: number;
    images: { url?: string } | null;
  };
}

interface StepAddonsProps {
  state: WizardState;
  onUpdate: (partial: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepAddons({ state, onUpdate, onNext, onBack }: StepAddonsProps) {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state.retreatId) return;
    (async () => {
      const res = await fetch(`/api/admin/retreat-addons?retreatId=${state.retreatId}`);
      if (res.ok) {
        const data = await res.json();
        // Fetch product details for each addon
        const addonRows = (data.addons ?? []) as Array<Record<string, unknown>>;
        if (addonRows.length > 0) {
          const productIds = addonRows.map((a) => a.product_id as string);
          const prodRes = await fetch('/api/admin/products/list');
          const prodData = await prodRes.json();
          const productsMap = new Map((prodData.products ?? []).map((p: Record<string, unknown>) => [p.id, p]));

          const enriched = addonRows.map((a) => ({
            id: a.id as string,
            product_id: a.product_id as string,
            custom_price: a.custom_price as number | null,
            product: productsMap.get(a.product_id as string) as Addon['product'] ?? {
              id: a.product_id as string, name: 'Unknown', short_description: null, base_price: 0, images: null,
            },
          }));
          setAddons(enriched);

          // Auto-select all by default if user hasn't made selections yet
          if (state.selectedAddonIds.length === 0 && enriched.length > 0) {
            onUpdate({ selectedAddonIds: enriched.map((a) => a.product_id) });
          }
        }
      }
      setLoading(false);
    })();
  }, [state.retreatId]);

  const toggleAddon = (productId: string) => {
    const current = state.selectedAddonIds;
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    onUpdate({ selectedAddonIds: next });
  };

  if (loading) {
    return <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (addons.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">No add-ons available for this retreat.</p>
        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back</Button>
          <Button size="sm" onClick={onNext}>Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button>
        </div>
      </div>
    );
  }

  const selectedTotal = addons
    .filter((a) => state.selectedAddonIds.includes(a.product_id))
    .reduce((sum, a) => sum + (a.custom_price ?? a.product.base_price ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Select Add-Ons</h2>
        <p className="text-sm text-muted-foreground">Optional extras for your retreat. Click to select or deselect.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {addons.map((addon) => {
          const selected = state.selectedAddonIds.includes(addon.product_id);
          const price = addon.custom_price ?? addon.product.base_price ?? 0;
          const imgUrl = addon.product.images?.url ?? null;

          return (
            <button key={addon.id} onClick={() => toggleAddon(addon.product_id)}
              className={`relative rounded-lg border overflow-hidden text-left transition-all hover:shadow-sm ${
                selected ? 'ring-2 ring-primary border-primary' : 'hover:border-foreground/20'
              }`}>
              {selected && (
                <div className="absolute top-1.5 right-1.5 z-10 rounded-full bg-primary p-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {imgUrl ? (
                <div className="aspect-[16/9] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl} alt={addon.product.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/9] bg-muted/50 flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">No image</span>
                </div>
              )}
              <div className="p-2.5 space-y-1">
                <p className="text-xs font-medium leading-tight line-clamp-2">{addon.product.name}</p>
                {addon.product.short_description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{addon.product.short_description}</p>
                )}
                <p className="text-xs font-semibold">
                  {price > 0 ? `+$${price.toFixed(0)}` : 'Included'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="text-sm">
          <span className="text-muted-foreground">{state.selectedAddonIds.length} add-on{state.selectedAddonIds.length !== 1 ? 's' : ''} selected</span>
          {selectedTotal > 0 && <span className="font-medium ml-2">+${selectedTotal.toFixed(0)}</span>}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back</Button>
        <Button size="sm" onClick={onNext}>Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button>
      </div>
    </div>
  );
}
