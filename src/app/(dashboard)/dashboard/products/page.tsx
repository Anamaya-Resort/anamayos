import { getDictionary } from '@/i18n';
import { getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Products — AO Platform' };

export default async function ProductsPage() {
  const locale = (await getSessionLocale()) as Locale;
  const dict = getDictionary(locale);
  const supabase = createServiceClient();

  const { data: products } = await supabase
    .from('products')
    .select('*, product_category_map(category_id, is_primary, product_categories(name, slug))')
    .eq('is_active', true)
    .order('sort_order');

  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name, slug, parent_id')
    .eq('is_active', true)
    .order('sort_order');

  const items = (products ?? []) as Array<Record<string, unknown>>;
  const cats = (categories ?? []) as Array<{ id: string; name: string; slug: string; parent_id: string | null }>;
  const topCats = cats.filter((c) => !c.parent_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={dict.products.title}
        description={`${items.length} ${dict.products.active.toLowerCase()}`}
      />

      {/* Category quick filters */}
      <div className="flex flex-wrap gap-2">
        {topCats.map((cat) => (
          <Badge key={cat.id} variant="outline" className="text-sm cursor-default">
            {cat.name}
          </Badge>
        ))}
      </div>

      {items.length === 0 ? (
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
                    <th className="pb-3 font-medium">{dict.products.duration}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const pType = p.product_type as string;
                    const typeLabel = dict.products[`type_${pType}` as keyof typeof dict.products] as string ?? pType;
                    const pcm = (p.product_category_map as Array<Record<string, unknown>>) ?? [];
                    const catNames = pcm.map((m) => (m.product_categories as Record<string, unknown>)?.name as string).filter(Boolean);

                    return (
                      <tr key={p.id as string} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 pr-4">
                          <span className="font-medium">{p.name as string}</span>
                          {Boolean(p.is_addon) && (
                            <Badge variant="outline" className="ml-2 text-xs">{dict.products.addon}</Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {catNames.map((cn) => (
                              <Badge key={cn} variant="outline" className="text-xs">{cn}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono">
                          {p.base_price != null ? `$${Number(p.base_price).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3">
                          {p.duration_minutes ? `${p.duration_minutes} min` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
