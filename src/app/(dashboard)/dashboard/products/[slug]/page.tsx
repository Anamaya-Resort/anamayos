import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared';
import { CategoryProductsClient } from '@/modules/products/category-products-client';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Category — AO Platform' };

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) redirect('/dashboard');

  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: category } = await supabase
    .from('product_categories')
    .select('id, name, slug, description, parent_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!category) notFound();
  const cat = category as Record<string, unknown>;
  const parentId = cat.parent_id as string | null;

  // Resolve back link: if sub-category, go to parent; else go to products main
  let backHref = '/dashboard/products';
  if (parentId) {
    const { data: parentCat } = await supabase.from('product_categories').select('slug').eq('id', parentId).single();
    if (parentCat) backHref = `/dashboard/products/${(parentCat as Record<string, unknown>).slug}`;
  }

  const { data: subCats } = await supabase
    .from('product_categories')
    .select('id, name, slug')
    .eq('parent_id', cat.id)
    .eq('is_active', true)
    .order('sort_order');

  const allCatIds = [cat.id as string, ...((subCats ?? []) as Array<Record<string, unknown>>).map((s) => s.id as string)];

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

  const { data: variants } = productIds.length > 0
    ? await supabase.from('product_variants').select('*').in('product_id', productIds).eq('is_active', true).order('sort_order')
    : { data: [] };

  const variantsByProduct: Record<string, Array<Record<string, unknown>>> = {};
  for (const v of (variants ?? []) as Array<Record<string, unknown>>) {
    const pid = v.product_id as string;
    if (!variantsByProduct[pid]) variantsByProduct[pid] = [];
    variantsByProduct[pid].push(v);
  }

  const productToSubCat: Record<string, string> = {};
  for (const m of (productMaps ?? []) as Array<Record<string, unknown>>) {
    const catInfo = m.product_categories as Record<string, unknown> | null;
    if (catInfo && m.category_id !== cat.id) {
      productToSubCat[m.product_id as string] = catInfo.name as string;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title={cat.name as string} description={cat.description as string ?? undefined} />
      </div>

      <CategoryProductsClient
        category={cat}
        subCats={(subCats ?? []) as Array<Record<string, unknown>>}
        products={products}
        variantsByProduct={variantsByProduct}
        productToSubCat={productToSubCat}
      />
    </div>
  );
}
