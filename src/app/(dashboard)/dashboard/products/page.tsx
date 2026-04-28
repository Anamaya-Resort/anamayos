import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { ProductsPageClient } from '@/modules/products/products-page-client';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Products — AO Platform' };

export default async function ProductsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const { data: products } = await supabase
    .from('products')
    .select('*, product_category_map(category_id, is_primary, product_categories(id, name, slug, parent_id))')
    .eq('is_active', true)
    .order('sort_order');

  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name, slug, description, parent_id, sort_order, icon')
    .eq('is_active', true)
    .order('sort_order');

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, product_id, name, price, duration_minutes, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  return (
    <ProductsPageClient
      products={(products ?? []) as Array<Record<string, unknown>>}
      categories={(categories ?? []) as Array<Record<string, unknown>>}
      variants={(variants ?? []) as Array<Record<string, unknown>>}
      dict={dict}
    />
  );
}
