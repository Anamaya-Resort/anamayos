'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState } from '@/components/shared';
import { Grid3X3, Table2, Upload, Loader2 } from 'lucide-react';
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

  const topCats = categories.filter((c) => !c.parent_id).sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0));

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
    if (data.imported > 0) {
      setTimeout(() => router.refresh(), 1000);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.products.title}
        description={`${products.length} active products across ${topCats.length} categories`}
        actions={
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
        }
      />

      {/* ── Cards View ── */}
      {tab === 'cards' && (
        topCats.length === 0 ? (
          <EmptyState title="No categories yet" description="Import products using the Import tab to populate categories." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {topCats.map((cat) => {
              const count = productCountByCategory.get(cat.id as string) ?? 0;
              const subCats = categories.filter((c) => c.parent_id === cat.id);
              return (
                <Card key={cat.id as string} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                  onClick={() => router.push(`/dashboard/products/${cat.slug}`)}>
                  <CardContent className="p-4 space-y-2">
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
                          <Badge key={sc.id as string} variant="outline" className="text-[10px]">{sc.name as string}</Badge>
                        ))}
                        {subCats.length > 4 && <Badge variant="outline" className="text-[10px]">+{subCats.length - 4}</Badge>}
                      </div>
                    )}
                  </CardContent>
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
                          <td className="py-3">{p.duration_minutes ? `${p.duration_minutes} min` : '—'}</td>
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
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => { setCsvText((ev.target?.result as string) ?? ''); };
                    reader.readAsText(file);
                  }
                  e.target.value = '';
                }} />
                <span className="inline-flex items-center gap-1.5 rounded border bg-background px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">
                  <Upload className="h-3.5 w-3.5" /> Upload CSV File
                </span>
              </label>
              <span className="text-xs text-muted-foreground self-center">or paste below</span>
            </div>

            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste CSV content here..."
              rows={12} className="w-full rounded border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 resize-y" />

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
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{err}</p>
                ))}
                {importResult.errors.length > 10 && <p className="text-xs text-muted-foreground">...and {importResult.errors.length - 10} more</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
