'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Fuse from 'fuse.js';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared';
import { Settings, Loader2, Upload, X, Search } from 'lucide-react';

interface Props {
  category: Record<string, unknown>;
  subCats: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  variantsByProduct: Record<string, Array<Record<string, unknown>>>;
  productToSubCat: Record<string, string>;
}

export function CategoryProductsClient({ category, subCats, products, variantsByProduct, productToSubCat }: Props) {
  const router = useRouter();
  const [editProduct, setEditProduct] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fuse = useMemo(() => new Fuse(products, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'short_description', weight: 1 },
      { name: 'description', weight: 0.5 },
    ],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 2,
  }), [products]);

  const displayProducts = searchQuery.trim().length >= 2
    ? fuse.search(searchQuery).map((r) => r.item)
    : products;

  const saveProductEdit = async () => {
    if (!editProduct) return;
    setSaving(true);
    await fetch('/api/admin/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editProduct),
    });
    setSaving(false);
    setEditProduct(null);
    router.refresh();
  };

  return (
    <>
      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products in this category..."
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
      </div>

      {/* Sub-category filter badges */}
      {subCats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subCats.map((sc) => (
            <Link key={sc.id as string} href={`/dashboard/products/${sc.slug}`}>
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors">{sc.name as string}</Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Product grid */}
      {displayProducts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {searchQuery.trim() ? `No products match "${searchQuery}"` : 'No products in this category yet. Use the Import tab to add products.'}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayProducts.map((p) => {
            const pvs = variantsByProduct[p.id as string] ?? [];
            const subCatName = productToSubCat[p.id as string];
            const price = Number(p.base_price) || 0;
            const imgObj = p.images as Record<string, unknown> | null;
            const imgUrl = (imgObj?.url as string) || null;

            return (
              <Card key={p.id as string} className="overflow-hidden hover:shadow-sm transition-shadow !p-0 gap-0 relative">
                {/* Gear icon */}
                <button className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setEditProduct({ ...p })} title="Edit product">
                  <Settings className="h-3.5 w-3.5" />
                </button>
                {imgUrl && (
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt={p.name as string} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{p.name as string}</h3>
                      {subCatName && <Badge variant="outline" className="text-[10px] mt-0.5">{subCatName}</Badge>}
                    </div>
                    <span className="text-sm font-semibold shrink-0">
                      {price > 0 ? `$${price.toFixed(0)}` : 'Free'}
                    </span>
                  </div>
                  {(p.short_description as string) && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.short_description as string}</p>
                  )}
                  {pvs.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {pvs.map((v) => (
                        <span key={v.id as string} className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                          {v.name as string} — ${Number(v.price).toFixed(0)}
                          {v.duration_minutes ? ` (${v.duration_minutes}min)` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                    {(p.duration_minutes as number) > 0 && <span>{p.duration_minutes as number} min</span>}
                    {Boolean(p.is_addon) && <Badge variant="outline" className="text-[9px] h-4">Add-on</Badge>}
                    {Boolean(p.requires_provider) && <span>Requires provider</span>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Product Edit Modal ── */}
      <Dialog open={!!editProduct} onOpenChange={(open) => { if (!open) setEditProduct(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          {editProduct && (
            <div className="space-y-3">
              <Field label="Name">
                <input value={(editProduct.name as string) ?? ''} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                  className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Short Description">
                <textarea value={(editProduct.short_description as string) ?? ''} onChange={(e) => setEditProduct({ ...editProduct, short_description: e.target.value })}
                  rows={2} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </Field>
              <Field label="Full Description">
                <textarea value={(editProduct.description as string) ?? ''} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
                  rows={4} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base Price ($)">
                  <input type="number" step="0.01" value={(editProduct.base_price as number) ?? 0}
                    onChange={(e) => setEditProduct({ ...editProduct, base_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" value={(editProduct.duration_minutes as number) ?? ''}
                    onChange={(e) => setEditProduct({ ...editProduct, duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max Participants">
                  <input type="number" value={(editProduct.max_participants as number) ?? 1}
                    onChange={(e) => setEditProduct({ ...editProduct, max_participants: parseInt(e.target.value) || 1 })}
                    className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </Field>
                <Field label="Sort Order">
                  <input type="number" value={(editProduct.sort_order as number) ?? 0}
                    onChange={(e) => setEditProduct({ ...editProduct, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
                </Field>
              </div>
              <Field label="Contraindications">
                <textarea value={(editProduct.contraindications as string) ?? ''} onChange={(e) => setEditProduct({ ...editProduct, contraindications: e.target.value })}
                  rows={2} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </Field>
              <Field label="Preparation Notes">
                <textarea value={(editProduct.preparation_notes as string) ?? ''} onChange={(e) => setEditProduct({ ...editProduct, preparation_notes: e.target.value })}
                  rows={2} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </Field>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editProduct.is_addon === true}
                    onChange={(e) => setEditProduct({ ...editProduct, is_addon: e.target.checked })} className="rounded border" />
                  Add-on
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editProduct.requires_provider === true}
                    onChange={(e) => setEditProduct({ ...editProduct, requires_provider: e.target.checked })} className="rounded border" />
                  Requires provider
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editProduct.is_active !== false}
                    onChange={(e) => setEditProduct({ ...editProduct, is_active: e.target.checked })} className="rounded border" />
                  Active
                </label>
              </div>
              <Field label="Image">
                <ProductImageUpload currentUrl={((editProduct.images as Record<string, unknown>)?.url as string) || null}
                  productId={editProduct.id as string}
                  onUploaded={(url) => setEditProduct((prev) => prev ? { ...prev, images: { url } } : prev)} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>Cancel</Button>
            <Button onClick={saveProductEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ProductImageUpload({ currentUrl, productId, onUploaded }: {
  currentUrl: string | null; productId: string; onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Not an image file'); return; }
    setUploading(true);
    setError(null);

    let uploadFile = file;
    if (file.size > 3 * 1024 * 1024) {
      try { uploadFile = await compressImage(file, 1400, 0.85); } catch { /* use original */ }
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('context', 'product');
    formData.append('id', productId);
    try {
      const res = await fetch('/api/admin/products/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) { onUploaded(data.url); }
      else { setError(data.error ?? `Upload failed (${res.status})`); }
    } catch { setError('Upload failed — try a smaller image'); }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      {currentUrl && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="Current" className="rounded border max-h-24 object-cover" />
          <button onClick={() => onUploaded('')}
            className="absolute -top-2 -right-2 rounded-full bg-destructive text-white p-0.5 hover:bg-destructive/80">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1 text-xs">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {currentUrl ? 'Replace' : 'Upload'}
        </Button>
        <Button size="sm" variant="outline" disabled={uploading} className="gap-1 text-xs"
          onClick={async () => {
            try {
              const items = await navigator.clipboard.read();
              for (const item of items) {
                const imgType = item.types.find((t) => t.startsWith('image/'));
                if (imgType) { const blob = await item.getType(imgType); handleFile(new File([blob], `pasted-${Date.now()}.${imgType.split('/')[1]}`, { type: imgType })); return; }
              }
              setError('No image found in clipboard');
            } catch { setError('Clipboard access denied'); }
          }}>
          Paste from Clipboard
        </Button>
        <span className="text-[10px] text-muted-foreground">1200px max, WebP</span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
}

function compressImage(file: File, maxWidth: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('no blob')); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
