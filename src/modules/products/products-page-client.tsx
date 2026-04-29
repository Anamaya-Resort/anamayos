'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, EmptyState } from '@/components/shared';
import { Grid3X3, Table2, Upload, Loader2, Settings, X, Trash2, Plus, Search } from 'lucide-react';
import type { TranslationKeys } from '@/i18n/en';

interface Props {
  products: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
  variants: Array<Record<string, unknown>>;
  dict: TranslationKeys;
}

export function ProductsPageClient({ products, categories, variants, dict }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'cards' | 'table' | 'import'>('cards');
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors?: string[] } | null>(null);

  // Edit modals
  const [editCat, setEditCat] = useState<Record<string, unknown> | null>(null);
  const [editProduct, setEditProduct] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createCat, setCreateCat] = useState<Record<string, unknown> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const topCats = categories.filter((c) => !c.parent_id).sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0));

  // Fuse.js fuzzy search across all products
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

  const searchResults = searchQuery.trim().length >= 2
    ? fuse.search(searchQuery).map((r) => r.item)
    : null;

  // Count products per top-level category
  const productCountByCategory = new Map<string, number>();
  for (const p of products) {
    const maps = (p.product_category_map as Array<Record<string, unknown>>) ?? [];
    for (const m of maps) {
      const cat = m.product_categories as Record<string, unknown> | null;
      if (!cat) continue;
      const parentId = cat.parent_id as string | null;
      const catId = parentId ?? (cat.id as string);
      productCountByCategory.set(catId, (productCountByCategory.get(catId) ?? 0) + 1);
    }
  }

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportResult(null);
    const res = await fetch('/api/admin/products/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json();
    setImportResult(data);
    setImporting(false);
    if (data.imported > 0) setTimeout(() => router.refresh(), 1000);
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const saveCategoryEdit = async () => {
    if (!editCat) return;
    setSaving(true);
    setSaveError(null);
    const res = await fetch('/api/admin/product-categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editCat),
    });
    if (res.ok) {
      setSaving(false);
      setEditCat(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setSaveError((data as Record<string, unknown>).error as string ?? `Save failed (${res.status})`);
      setSaving(false);
    }
  };

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

  const deleteCategory = async () => {
    if (!deleteCatId) return;
    setDeleting(true);
    await fetch(`/api/admin/product-categories?id=${deleteCatId}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteCatId(null);
    setEditCat(null);
    router.refresh();
  };

  const saveNewCategory = async () => {
    if (!createCat || !(createCat.name as string)?.trim()) return;
    setSaving(true);
    await fetch('/api/admin/product-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createCat),
    });
    setSaving(false);
    setCreateCat(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.products.title}
        description={`${products.length} active products across ${topCats.length} categories`}
        actions={
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => setCreateCat({ name: '', slug: '', description: '', icon: '', sort_order: 99 })} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Product Category
            </Button>
            <div className="flex gap-1 border rounded-lg p-0.5">
              <button onClick={() => setTab('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded ${tab === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Grid3X3 className="h-3.5 w-3.5" /> Cards
              </button>
              <button onClick={() => setTab('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded ${tab === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Table2 className="h-3.5 w-3.5" /> Table
              </button>
              <button onClick={() => setTab('import')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded ${tab === 'import' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Upload className="h-3.5 w-3.5" /> Import
              </button>
            </div>
          </div>
        }
      />

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name or description..."
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
      </div>

      {/* ── Search Results ── */}
      {searchResults !== null ? (
        searchResults.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No products match &ldquo;{searchQuery}&rdquo;</p>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {searchResults.map((p) => {
                const imgObj = p.images as Record<string, unknown> | null;
                const imgUrl = (imgObj?.url as string) || null;
                const price = Number(p.base_price) || 0;
                const pcm = (p.product_category_map as Array<Record<string, unknown>>) ?? [];
                const catNames = pcm.map((m) => (m.product_categories as Record<string, unknown>)?.name as string).filter(Boolean);

                return (
                  <Card key={p.id as string} className="overflow-hidden hover:shadow-sm transition-shadow !p-0 gap-0 relative">
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
                        <h3 className="text-sm font-semibold">{p.name as string}</h3>
                        <span className="text-sm font-semibold shrink-0">
                          {price > 0 ? `$${price.toFixed(0)}` : 'Free'}
                        </span>
                      </div>
                      {(p.short_description as string) && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.short_description as string}</p>
                      )}
                      {catNames.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {catNames.map((cn) => <Badge key={cn} variant="outline" className="text-[10px]">{cn}</Badge>)}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      ) : (
      <>
      {/* ── Cards View (no search) ── */}
      {tab === 'cards' && (
        topCats.length === 0 ? (
          <EmptyState title="No categories yet" description="Import products using the Import tab to populate categories." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {topCats.map((cat) => {
              const count = productCountByCategory.get(cat.id as string) ?? 0;
              const subCats = categories.filter((c) => c.parent_id === cat.id);
              const imgUrl = cat.icon as string | null;
              return (
                <Card key={cat.id as string} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden relative !p-0 gap-0"
                  onClick={() => router.push(`/dashboard/products/${cat.slug}`)}>
                  {/* Gear icon */}
                  <button className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => { e.stopPropagation(); setEditCat({ ...cat }); }} title="Edit category">
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                  {imgUrl && (
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl} alt={cat.name as string} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-sm">{cat.name as string}</h3>
                    {(cat.description as string) && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{cat.description as string}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">{count} product{count !== 1 ? 's' : ''}</span>
                      {subCats.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">{subCats.length} sub-categories</span>
                      )}
                    </div>
                    {subCats.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {subCats.slice(0, 4).map((sc) => (
                          <button key={sc.id as string} onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/products/${sc.slug}`); }}
                            className="cursor-pointer">
                            <Badge variant="outline" className="text-[10px] hover:bg-muted transition-colors">{sc.name as string}</Badge>
                          </button>
                        ))}
                        {subCats.length > 4 && <Badge variant="outline" className="text-[10px]">+{subCats.length - 4}</Badge>}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ── Table View ── */}
      {tab === 'table' && (
        products.length === 0 ? (
          <EmptyState title={dict.products.noProducts} description={dict.products.noProductsDesc} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 font-medium">{dict.products.name}</th>
                      <th className="pb-3 pr-4 font-medium">{dict.products.type}</th>
                      <th className="pb-3 pr-4 font-medium">{dict.products.categories}</th>
                      <th className="pb-3 pr-4 font-medium">{dict.products.price}</th>
                      <th className="pb-3 pr-4 font-medium">Variants</th>
                      <th className="pb-3 font-medium">{dict.products.duration}</th>
                      <th className="pb-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const pType = p.product_type as string;
                      const typeLabel = dict.products[`type_${pType}` as keyof typeof dict.products] as string ?? pType;
                      const pcm = (p.product_category_map as Array<Record<string, unknown>>) ?? [];
                      const catNames = pcm.map((m) => (m.product_categories as Record<string, unknown>)?.name as string).filter(Boolean);
                      const productVariants = variants.filter((v) => v.product_id === p.id);

                      return (
                        <tr key={p.id as string} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 pr-4">
                            <span className="font-medium">{p.name as string}</span>
                            {Boolean(p.is_addon) && <Badge variant="outline" className="ml-2 text-xs">{dict.products.addon}</Badge>}
                          </td>
                          <td className="py-3 pr-4"><Badge variant="outline" className="text-xs">{typeLabel}</Badge></td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {catNames.map((cn) => <Badge key={cn} variant="outline" className="text-xs">{cn}</Badge>)}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono">
                            {p.base_price != null && Number(p.base_price) > 0 ? `$${Number(p.base_price).toFixed(0)}` : 'Free'}
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground">
                            {productVariants.length > 0 ? productVariants.map((v) => v.name as string).join(', ') : '—'}
                          </td>
                          <td className="py-3 pr-4">{(p.duration_minutes as number) ? `${p.duration_minutes} min` : '—'}</td>
                          <td className="py-3">
                            <button onClick={() => setEditProduct({ ...p })} className="text-muted-foreground hover:text-foreground">
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* ── Import View ── */}
      {tab === 'import' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Import Products from CSV</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Paste your CSV below or upload a file. Expected columns: category, subcategory, name, slug, description, short_description, base_price, variant_names, variant_prices, variant_durations, duration_minutes, max_participants, provider_name, provider_type, is_addon, requires_provider, contraindications, preparation_notes, currency, sort_order
              </p>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { const reader = new FileReader(); reader.onload = (ev) => { setCsvText((ev.target?.result as string) ?? ''); }; reader.readAsText(file); }
                  e.target.value = '';
                }} />
                <span className="inline-flex items-center gap-1.5 rounded border bg-background px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                  <Upload className="h-3.5 w-3.5" /> Upload CSV File
                </span>
              </label>
              <span className="text-xs text-muted-foreground self-center">or paste below</span>
            </div>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste CSV content here..." rows={12}
              className="w-full rounded border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
            <div className="flex items-center gap-3">
              <Button onClick={handleImport} disabled={importing || !csvText.trim()}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Import Products
              </Button>
              {importResult && (
                <div className="text-sm">
                  <span className="text-green-600 font-medium">{importResult.imported} imported</span>
                  {importResult.skipped > 0 && <span className="text-amber-600 ml-2">{importResult.skipped} skipped</span>}
                </div>
              )}
            </div>
            {importResult?.errors && importResult.errors.length > 0 && (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <p className="text-xs font-medium text-destructive">Errors:</p>
                {importResult.errors.slice(0, 10).map((err, i) => <p key={i} className="text-xs text-muted-foreground">{err}</p>)}
                {importResult.errors.length > 10 && <p className="text-xs text-muted-foreground">...and {importResult.errors.length - 10} more</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </>
      )}

      {/* ── Category Edit Modal ── */}
      <Dialog open={!!editCat} onOpenChange={(open) => { if (!open) setEditCat(null); }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Edit Category</DialogTitle>
              <div className="flex items-center gap-1">
                <button onClick={() => { if (editCat) setDeleteCatId(editCat.id as string); }}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete category">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => setEditCat(null)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DialogHeader>
          {editCat && (
            <div className="space-y-3">
              <Field label="Name">
                <input value={(editCat.name as string) ?? ''} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                  className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Description">
                <textarea value={(editCat.description as string) ?? ''} onChange={(e) => setEditCat({ ...editCat, description: e.target.value })}
                  rows={3} className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </Field>
              <Field label="Slug">
                <input value={(editCat.slug as string) ?? ''} onChange={(e) => setEditCat({ ...editCat, slug: e.target.value })}
                  className="w-full rounded border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Sort Order">
                <input type="number" value={(editCat.sort_order as number) ?? 0} onChange={(e) => setEditCat({ ...editCat, sort_order: Number(e.target.value) })}
                  className="w-24 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Image">
                <ImageUpload currentUrl={(editCat.icon as string) || null} context="category" contextId={editCat.id as string}
                  onUploaded={(url) => setEditCat((prev) => prev ? { ...prev, icon: url } : prev)} />
              </Field>
            </div>
          )}
          {saveError && <p className="text-xs text-destructive px-4">{saveError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCat(null)}>Cancel</Button>
            <Button onClick={saveCategoryEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <ImageUpload currentUrl={((editProduct.images as Record<string, unknown>)?.url as string) || null}
                  context="product" contextId={editProduct.id as string}
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

      {/* ── Delete Category Confirmation ── */}
      <Dialog open={!!deleteCatId} onOpenChange={(open) => { if (!open) setDeleteCatId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirm Delete Category Card</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this category and remove all product associations within it. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCatId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCategory} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Category Modal ── */}
      <Dialog open={!!createCat} onOpenChange={(open) => { if (!open) setCreateCat(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Product Category</DialogTitle></DialogHeader>
          {createCat && (
            <div className="space-y-3">
              <Field label="Name *">
                <input value={(createCat.name as string) ?? ''} onChange={(e) => setCreateCat({ ...createCat, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })}
                  placeholder="e.g. Spa & Wellness" className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Slug">
                <input value={(createCat.slug as string) ?? ''} onChange={(e) => setCreateCat({ ...createCat, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="auto-generated" className="w-full rounded border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Description">
                <textarea value={(createCat.description as string) ?? ''} onChange={(e) => setCreateCat({ ...createCat, description: e.target.value })}
                  placeholder="What products belong in this category?" rows={3}
                  className="w-full rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 resize-y" />
              </Field>
              <Field label="Sort Order">
                <input type="number" value={(createCat.sort_order as number) ?? 99} onChange={(e) => setCreateCat({ ...createCat, sort_order: Number(e.target.value) })}
                  className="w-24 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50" />
              </Field>
              <Field label="Image">
                <ImageUpload currentUrl={(createCat.icon as string) || null} context="category" contextId="new"
                  onUploaded={(url) => setCreateCat((prev) => prev ? { ...prev, icon: url } : prev)} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCat(null)}>Cancel</Button>
            <Button onClick={saveNewCategory} disabled={saving || !(createCat?.name as string)?.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

function ImageUpload({ currentUrl, context, contextId, onUploaded }: {
  currentUrl: string | null; context: string; contextId: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Not an image file'); return; }
    setUploading(true);
    setError(null);

    // Compress on client first to stay under Vercel's 4.5MB limit
    let uploadFile = file;
    if (file.size > 3 * 1024 * 1024) {
      try {
        uploadFile = await compressImage(file, 1400, 0.85);
      } catch { /* use original if compression fails */ }
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('context', context);
    formData.append('id', contextId);
    try {
      const res = await fetch('/api/admin/products/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        onUploaded(data.url);
      } else {
        setError(data.error ?? `Upload failed (${res.status})`);
      }
    } catch {
      setError(`Upload failed — file may be too large (${(uploadFile.size / 1024 / 1024).toFixed(1)}MB). Try a smaller image.`);
    }
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
                if (imgType) {
                  const blob = await item.getType(imgType);
                  const file = new File([blob], `pasted-${Date.now()}.${imgType.split('/')[1]}`, { type: imgType });
                  handleFile(file);
                  return;
                }
              }
              setError('No image found in clipboard');
            } catch {
              setError('Clipboard access denied — try uploading instead');
            }
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

/** Compress image on client using canvas before upload */
function compressImage(file: File, maxWidth: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('no blob')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
