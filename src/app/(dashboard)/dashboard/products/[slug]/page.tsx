import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Category — AO Platform' };

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServiceClient();

  // Get the category
  const { data: category } = await supabase
    .from('product_categories')
    .select('id, name, slug, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!category) notFound();
  const cat = category as Record<string, unknown>;

  // Get sub-categories
  const { data: subCats } = await supabase
    .from('product_categories')
    .select('id, name, slug')
    .eq('parent_id', cat.id)
    .eq('is_active', true)
    .order('sort_order');

  const allCatIds = [cat.id as string, ...((subCats ?? []) as Array<Record<string, unknown>>).map((s) => s.id as string)];

  // Get products in this category or its sub-categories
  const { data: productMaps } = await supabase
    .from('product_category_map')
    .select('product_id, category_id, product_categories(name)')
    .in('category_id', allCatIds);

  const productIds = [...new Set((productMaps ?? []).map((m: Record<string, unknown>) => m.product_id as string))];

  let products: Array<Record<string, unknown>> = [];
  if (productIds.length > 0) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true)
      .order('sort_order');
    products = (data ?? []) as Array<Record<string, unknown>>;
  }

  // Get variants for these products
  const { data: variants } = productIds.length > 0
    ? await supabase.from('product_variants').select('*').in('product_id', productIds).eq('is_active', true).order('sort_order')
    : { data: [] };

  const variantsByProduct = new Map<string, Array<Record<string, unknown>>>();
  for (const v of (variants ?? []) as Array<Record<string, unknown>>) {
    const pid = v.product_id as string;
    if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
    variantsByProduct.get(pid)!.push(v);
  }

  // Map product → sub-category name
  const productToSubCat = new Map<string, string>();
  for (const m of (productMaps ?? []) as Array<Record<string, unknown>>) {
    const catInfo = m.product_categories as Record<string, unknown> | null;
    if (catInfo && m.category_id !== cat.id) {
      productToSubCat.set(m.product_id as string, catInfo.name as string);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/products" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title={cat.name as string} description={cat.description as string ?? undefined} />
      </div>

      {/* Sub-category filter badges */}
      {(subCats ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(subCats as Array<Record<string, unknown>>).map((sc) => (
            <Badge key={sc.id as string} variant="outline" className="text-xs">{sc.name as string}</Badge>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No products in this category yet. Use the Import tab to add products.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const pvs = variantsByProduct.get(p.id as string) ?? [];
            const subCatName = productToSubCat.get(p.id as string);
            const price = Number(p.base_price) || 0;

            return (
              <Card key={p.id as string} className="overflow-hidden hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-2">
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

                  {/* Variants */}
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

                  {/* Meta */}
                  <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                    {(p.duration_minutes as number) && <span>{p.duration_minutes as number} min</span>}
                    {Boolean(p.is_addon) && <Badge variant="outline" className="text-[9px] h-4">Add-on</Badge>}
                    {Boolean(p.requires_provider) && <span>Requires provider</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
