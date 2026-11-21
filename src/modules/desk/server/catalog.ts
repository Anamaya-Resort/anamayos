import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { DESK_CONFIG, type ShopTile } from '../config';
import type { DeskCatalog, ShopItem, SpaTreatment } from '../types';
import { listRooms, listTherapists } from './day';
import { effectivePrices } from './prices';

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  commission_amount: number | null;
  currency: string;
  is_addon: boolean;
  sort_order: number;
  spa_categories: { name: string; sort_order: number | null } | null;
  service_providers: { person_id: string; is_active: boolean; persons: { full_name: string | null } | null }[];
}

export async function getIvaRate(): Promise<number> {
  const { data } = await createServiceClient().from('tax_rates').select('rate').eq('slug', 'iva').eq('is_active', true).maybeSingle();
  return Number(data?.rate ?? 0);
}

async function spaTreatments(date: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('service_catalog')
    .select(`id, name, duration_minutes, price, commission_amount, currency, is_addon, sort_order,
      spa_categories:category_id ( name, sort_order ),
      service_providers ( person_id, is_active, persons:person_id ( full_name ) )`)
    .eq('domain', 'spa')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ServiceRow[];

  const { data: products } = await supabase.from('products').select('id, service_catalog_id').in('service_catalog_id', rows.map((r) => r.id));
  const productOf = new Map((products ?? []).map((p) => [p.service_catalog_id as string, p.id as string]));
  const prices = await effectivePrices(rows, date);

  // Group lengths of the same treatment (Relaxing 60/75/90) into one card.
  const byName = new Map<string, SpaTreatment & { order: number }>();
  for (const r of rows) {
    const productId = productOf.get(r.id);
    if (!productId) continue;
    const t = byName.get(r.name) ?? {
      key: r.name, name: r.name, isAddon: r.is_addon,
      category: r.spa_categories?.name ?? '',
      order: (r.spa_categories?.sort_order ?? 0) * 1000 + r.sort_order,
      options: [], providers: [],
    };
    t.options.push({ serviceId: r.id, productId, minutes: r.duration_minutes, price: prices.get(r.id)?.price ?? Number(r.price) });
    for (const p of r.service_providers) {
      if (p.is_active && !t.providers.some((x) => x.personId === p.person_id)) {
        t.providers.push({ personId: p.person_id, name: p.persons?.full_name ?? '' });
      }
    }
    byName.set(r.name, t);
  }
  const all = [...byName.values()].sort((a, b) => a.order - b.order);
  for (const t of all) t.options.sort((a, b) => a.minutes - b.minutes);
  const strip = (t: SpaTreatment & { order: number }): SpaTreatment => {
    const { order, ...rest } = t;
    void order;
    return rest;
  };
  return {
    currency: rows[0]?.currency ?? 'USD',
    treatments: all.filter((t) => !t.isAddon).map(strip),
    addons: all.filter((t) => t.isAddon).map(strip),
  };
}

interface VariantRow { id: string; name: string; price: number; is_active: boolean; sort_order: number }

async function shopItems(): Promise<ShopItem[]> {
  const supabase = createServiceClient();
  const { data: cats } = await supabase.from('product_categories').select('id, slug, name, parent_id').eq('is_active', true);
  const byId = new Map((cats ?? []).map((c) => [c.id as string, c]));
  const topSlug = (id: string) => {
    let c = byId.get(id);
    while (c?.parent_id && byId.get(c.parent_id)) c = byId.get(c.parent_id);
    return c?.slug as string | undefined;
  };
  const tileOf = (slug?: string) =>
    (Object.keys(DESK_CONFIG.shopTiles) as ShopTile[]).find((k) => slug && (DESK_CONFIG.shopTiles[k] as readonly string[]).includes(slug));

  const { data } = await supabase
    .from('products')
    .select('id, name, base_price, price_on_request, duration_minutes, sort_order, product_category_map ( category_id ), product_variants ( id, name, price, is_active, sort_order )')
    .eq('is_active', true)
    .is('service_catalog_id', null)
    .order('sort_order');

  const items: ShopItem[] = [];
  for (const p of data ?? []) {
    const maps = (p.product_category_map ?? []) as { category_id: string }[];
    for (const m of maps) {
      const tile = tileOf(topSlug(m.category_id));
      if (!tile) continue;
      const category = (byId.get(m.category_id)?.name as string) ?? '';
      const base = { productId: p.id, minutes: p.duration_minutes ?? null, tile, category };
      const variants = ((p.product_variants ?? []) as VariantRow[]).filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);
      if (variants.length) {
        for (const v of variants) items.push({ ...base, key: `${p.id}:${v.id}`, variantId: v.id, name: `${p.name} · ${v.name}`, price: Number(v.price) });
      } else if (!p.price_on_request && p.base_price != null) {
        // Quote-only items (private taxis, charters) are booked with the supplier, not charged here.
        items.push({ ...base, key: p.id, variantId: null, name: p.name, price: Number(p.base_price) });
      }
      break;
    }
  }
  return items;
}

export async function getDeskCatalog(date: string): Promise<DeskCatalog> {
  const [spa, items, ivaRate, rooms, therapists] = await Promise.all([spaTreatments(date), shopItems(), getIvaRate(), listRooms(), listTherapists()]);
  return { date, currency: spa.currency, ivaRate, rooms, therapists, treatments: spa.treatments, addons: spa.addons, items };
}
