'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SignaturePad } from '@/components/shared';
import { calculateLineItemPrice, formatCurrency } from '@/lib/pricing';
import { Loader2 } from 'lucide-react';
import type { BookingDetail } from './types';
import type { Product, ProductVariant, TaxRate } from '@/types';
import type { TranslationKeys } from '@/i18n/en';

interface ChargeEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingDetail;
  dict: TranslationKeys;
  onCreated: () => void;
}

interface ProductOption extends Product {
  variants?: ProductVariant[];
  category_slugs?: string[];
}

export function ChargeEntryModal({ open, onOpenChange, booking, dict, onCreated }: ChargeEntryModalProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [participantId, setParticipantId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [location, setLocation] = useState<{ name?: string; coords?: string }>({});

  const f = dict.folio;

  // Load products and tax rates on open
  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/tax-rates')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTaxRates(data); });

    // Fetch products with variants and categories
    // Using a simple approach: fetch products, then variants
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON;
    if (!supabaseUrl || !supabaseAnon) return;

    const headers = { apikey: supabaseAnon, Authorization: `Bearer ${supabaseAnon}` };

    Promise.all([
      fetch(`${supabaseUrl}/rest/v1/products?is_active=eq.true&order=name&select=*,product_category_map(product_categories(slug)),product_variants(*)`, { headers }).then((r) => r.json()),
    ]).then(([prods]) => {
      const mapped = (prods ?? []).map((p: Record<string, unknown>) => {
        const catMaps = (p.product_category_map ?? []) as Array<{ product_categories: { slug: string } | null }>;
        const categorySlugs = catMaps.map((m) => m.product_categories?.slug).filter(Boolean) as string[];
        return { ...p, category_slugs: categorySlugs, variants: p.product_variants ?? [] };
      });
      setProducts(mapped as ProductOption[]);
    });
  }, [open]);

  // Set default participant
  useEffect(() => {
    if (booking.participants.length > 0 && !participantId) {
      const primary = booking.participants.find((p) => p.is_primary);
      setParticipantId(primary?.person_id ?? booking.participants[0]?.person_id ?? '');
    }
  }, [booking.participants, participantId]);

  // Capture geolocation
  useEffect(() => {
    if (showSignature && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ coords: `${pos.coords.latitude},${pos.coords.longitude}` });
        },
        () => { /* silently fail */ },
        { timeout: 5000 },
      );
    }
  }, [showSignature]);

  const filteredProducts = search.length >= 2
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products.slice(0, 20);

  const unitPrice = selectedVariant?.price ?? selectedProduct?.base_price ?? 0;

  const pricing = selectedProduct
    ? calculateLineItemPrice({
        unitPrice,
        quantity,
        taxRates,
        productCategorySlugs: selectedProduct.category_slugs ?? [],
      })
    : null;

  const reset = useCallback(() => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setQuantity(1);
    setSearch('');
    setSignature(null);
    setShowSignature(false);
    setError('');
    setLocation({});
  }, []);

  async function handleSubmit() {
    if (!selectedProduct) return;
    setSaving(true);
    setError('');

    try {
      // Create line item
      const res = await fetch('/api/admin/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          product_id: selectedProduct.id,
          variant_id: selectedVariant?.id || null,
          person_id: participantId || null,
          quantity,
          unit_price: unitPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || dict.common.error);
        return;
      }

      // If signed, add approval
      if (signature && data.id) {
        await fetch('/api/admin/line-items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: data.id,
            approved_signature: signature,
            approved_location_name: location.name ?? null,
            approved_location_coords: location.coords ?? null,
            approved_by_person_id: participantId || null,
            approval_method: 'staff_presented',
          }),
        });
      }

      reset();
      onCreated();
      onOpenChange(false);
    } catch {
      setError(dict.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{f.addCharge}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Participant selector */}
          {booking.participants.length > 1 && (
            <div>
              <Label>{f.selectParticipant}</Label>
              <select
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {booking.participants.map((p) => (
                  <option key={p.id} value={p.person_id ?? ''}>
                    {p.full_name}{p.is_primary ? ` (${dict.bookings.primaryGuest})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Product search */}
          {!selectedProduct ? (
            <div>
              <Label>{f.selectProduct}</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={dict.products.searchPlaceholder}
              />
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border/30 last:border-0"
                    onClick={() => {
                      setSelectedProduct(p);
                      if (p.variants && p.variants.length === 1) {
                        setSelectedVariant(p.variants[0]);
                      }
                    }}
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.base_price ? (
                      <span className="ml-2 text-muted-foreground">
                        {formatCurrency(p.base_price, p.currency)}
                      </span>
                    ) : null}
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{dict.common.noResults}</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <Label>{dict.products.name}</Label>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(null); setSelectedVariant(null); }}>
                  {dict.common.back}
                </Button>
              </div>
              <p className="text-sm font-medium">{selectedProduct.name}</p>

              {/* Variant picker */}
              {selectedProduct.variants && selectedProduct.variants.length > 1 && (
                <div className="mt-3">
                  <Label>{f.selectVariant}</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`px-3 py-1.5 text-sm rounded-md border ${
                          selectedVariant?.id === v.id
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:bg-muted'
                        }`}
                        onClick={() => setSelectedVariant(v)}
                      >
                        {v.name} — {formatCurrency(v.price, v.currency)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mt-3">
                <Label>{f.quantity}</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                />
              </div>

              {/* Pricing preview */}
              {pricing && (
                <div className="mt-4 p-3 rounded-md bg-muted/50 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>{f.subtotal}</span>
                    <span>{formatCurrency(pricing.subtotal)}</span>
                  </div>
                  {pricing.taxes.map((t, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{t.name} ({(t.rate * 100).toFixed(0)}%)</span>
                      <span>{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t border-border pt-1">
                    <span>{f.total}</span>
                    <span>{formatCurrency(pricing.total)}</span>
                  </div>
                </div>
              )}

              {/* Signature area */}
              {showSignature ? (
                <div className="mt-4">
                  <SignaturePad
                    onCapture={setSignature}
                    onClear={() => setSignature(null)}
                    label={f.signHere}
                    clearLabel={f.clearSignature}
                  />
                  {signature && (
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      {f.signed} ✓
                    </p>
                  )}
                </div>
              ) : null}

              {error && <p className="text-sm text-destructive">{error}</p>}

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-4">
                {!showSignature && (
                  <Button
                    variant="outline"
                    onClick={() => setShowSignature(true)}
                    className="ao-btn-fx--subtle"
                  >
                    {f.presentForSigning}
                  </Button>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="ao-btn-fx--success"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {showSignature ? f.submitSignature : f.addWithoutSignature}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
