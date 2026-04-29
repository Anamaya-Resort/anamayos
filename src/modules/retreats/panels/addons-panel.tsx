'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, ChevronDown } from 'lucide-react';

// Default add-on product slugs — pre-selected when building a new retreat
const DEFAULT_ADDON_SLUGS = ['yoga-10-pack', 'meal-plan-high-protein', 'meal-plan-keto'];

interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  base_price: number;
  images: { url?: string } | null;
}

interface RetreatAddon {
  id: string;
  product_id: string;
  custom_price: number | null;
  is_required: boolean;
  is_active: boolean;
}

interface Props {
  retreatId: string;
}

export function AddonsPanel({ retreatId }: Props) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<RetreatAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load all products + current retreat addons
  useEffect(() => {
    (async () => {
      const [productsRes, addonsRes] = await Promise.all([
        fetch('/api/admin/products/list'),
        fetch(`/api/admin/retreat-addons?retreatId=${retreatId}`),
      ]);
      const productsData = await productsRes.json();
      const addonsData = await addonsRes.json();
      setAllProducts(productsData.products ?? []);
      const existing = (addonsData.addons ?? []) as RetreatAddon[];
      setAddons(existing);
      setInitialized(existing.length > 0);
      setLoading(false);
    })();
  }, [retreatId]);

  // Auto-select defaults for new retreats (no addons yet)
  useEffect(() => {
    if (loading || initialized || allProducts.length === 0) return;
    const defaults = allProducts.filter((p) => DEFAULT_ADDON_SLUGS.includes(p.slug));
    if (defaults.length > 0) {
      const newAddons = defaults.map((p) => ({
        id: '', product_id: p.id, custom_price: null, is_required: false, is_active: true,
      }));
      setAddons(newAddons);
      setInitialized(true);
      // Save defaults
      saveAddons(newAddons, allProducts);
    }
  }, [loading, initialized, allProducts]);

  const selectedIds = new Set(addons.map((a) => a.product_id));

  const toggleProduct = (product: Product) => {
    let next: RetreatAddon[];
    if (selectedIds.has(product.id)) {
      next = addons.filter((a) => a.product_id !== product.id);
    } else {
      next = [...addons, { id: '', product_id: product.id, custom_price: null, is_required: false, is_active: true }];
    }
    setAddons(next);
    saveAddons(next, allProducts);
  };

  const saveAddons = useCallback(async (addonList: RetreatAddon[], products: Product[]) => {
    setSaving(true);
    await fetch('/api/admin/retreat-addons', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retreat_id: retreatId,
        addons: addonList.map((a, i) => ({
          product_id: a.product_id,
          custom_price: a.custom_price,
          is_required: a.is_required,
          sort_order: i,
          is_active: true,
        })),
      }),
    });
    setSaving(false);
  }, [retreatId]);

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const selectedProducts = allProducts.filter((p) => selectedIds.has(p.id));
  const unselectedProducts = allProducts.filter((p) => !selectedIds.has(p.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Select products and services available as add-ons for this retreat.
          {saving && <span className="ml-2 text-primary">Saving...</span>}
        </p>
      </div>

      {/* Selected add-ons */}
      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Selected ({selectedProducts.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {selectedProducts.map((p) => (
              <MiniProductCard key={p.id} product={p} selected onClick={() => toggleProduct(p)} />
            ))}
          </div>
        </div>
      )}

      {/* Expand/collapse for full product list */}
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80">
        {expanded ? 'Hide' : 'Browse'} all products ({unselectedProducts.length} available)
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {unselectedProducts.map((p) => (
              <MiniProductCard key={p.id} product={p} selected={false} onClick={() => toggleProduct(p)} />
            ))}
          </div>
          {unselectedProducts.length > 0 && selectedProducts.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setExpanded(false)} className="text-xs">
              Done Selecting
            </Button>
          )}
        </div>
      )}

      {selectedProducts.length === 0 && !expanded && (
        <p className="text-xs text-muted-foreground italic">No add-ons selected. Click &ldquo;Browse&rdquo; to choose from available products.</p>
      )}
    </div>
  );
}

function MiniProductCard({ product, selected, onClick }: { product: Product; selected: boolean; onClick: () => void }) {
  const imgUrl = product.images?.url ?? null;
  const price = product.base_price ?? 0;

  return (
    <button onClick={onClick}
      className={`relative rounded-lg border overflow-hidden text-left transition-all hover:shadow-sm ${
        selected ? 'ring-2 ring-primary border-primary' : 'hover:border-foreground/20'
      }`}>
      {selected && (
        <div className="absolute top-1 right-1 z-10 rounded-full bg-primary p-0.5">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
      {imgUrl ? (
        <div className="aspect-[16/9] overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-muted/50 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">No image</span>
        </div>
      )}
      <div className="p-2 space-y-0.5">
        <p className="text-[11px] font-medium leading-tight line-clamp-2">{product.name}</p>
        <p className="text-[10px] text-muted-foreground font-medium">
          {price > 0 ? `$${price.toFixed(0)}` : 'Free'}
        </p>
      </div>
    </button>
  );
}
