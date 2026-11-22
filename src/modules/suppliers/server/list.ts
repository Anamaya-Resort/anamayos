import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { Supplier, SupplierItem, SupplierKind } from '../types';

const num = (v: unknown) => (v == null ? null : Number(v));

interface ProductRow {
  id: string; name: string; description: string | null; supplier_id: string; sort_order: number;
  base_price: number | null; net_price: number | null; price_unit: string | null; price_on_request: boolean; price_notes: string | null;
  duration_minutes: number | null; min_participants: number | null; max_participants: number | null; min_age: number | null;
  schedule: string | null; season: string | null; includes: string | null; what_to_bring: string | null; meeting_point: string | null;
  cancellation_policy: string | null; internal_notes: string | null; is_active: boolean;
  product_variants: { id: string; name: string; price: number; net_price: number | null; is_active: boolean; sort_order: number }[];
  product_category_map: { is_primary: boolean; product_categories: { name: string } | null }[];
}

/** Every supplier (listed and not listed) with their active excursions and transfers. */
export async function listSuppliers(): Promise<Supplier[]> {
  const supabase = createServiceClient();
  const [{ data: suppliers, error }, { data: products, error: pErr }] = await Promise.all([
    supabase.from('suppliers').select('*').order('sort_order'),
    supabase
      .from('products')
      .select(`id, name, description, supplier_id, sort_order, base_price, net_price, price_unit, price_on_request, price_notes,
        duration_minutes, min_participants, max_participants, min_age, schedule, season, includes, what_to_bring, meeting_point,
        cancellation_policy, internal_notes, is_active,
        product_variants ( id, name, price, net_price, is_active, sort_order ),
        product_category_map ( is_primary, product_categories:category_id ( name ) )`)
      .not('supplier_id', 'is', null)
      .eq('is_active', true)
      .order('sort_order'),
  ]);
  if (error) throw new Error(error.message);
  if (pErr) throw new Error(pErr.message);

  const itemsBySupplier = new Map<string, SupplierItem[]>();
  for (const p of (products ?? []) as unknown as ProductRow[]) {
    const cat = p.product_category_map.find((m) => m.is_primary) ?? p.product_category_map[0];
    const item: SupplierItem = {
      id: p.id, name: p.name, description: p.description, category: cat?.product_categories?.name ?? '',
      price: num(p.base_price), net: num(p.net_price), priceUnit: p.price_unit, onRequest: p.price_on_request, priceNotes: p.price_notes,
      minutes: p.duration_minutes, minPeople: p.min_participants, maxPeople: p.max_participants, minAge: p.min_age,
      schedule: p.schedule, season: p.season, includes: p.includes, bring: p.what_to_bring, meetingPoint: p.meeting_point,
      cancellation: p.cancellation_policy, internalNotes: p.internal_notes,
      options: p.product_variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order)
        .map((v) => ({ id: v.id, name: v.name, price: Number(v.price), net: num(v.net_price) })),
    };
    const list = itemsBySupplier.get(p.supplier_id) ?? [];
    list.push(item);
    itemsBySupplier.set(p.supplier_id, list);
  }

  return (suppliers ?? []).map((s) => ({
    id: s.id, name: s.name, legalName: s.legal_name, kinds: (s.kinds ?? []) as SupplierKind[],
    contactName: s.contact_name, whatsapp: s.whatsapp, phone: s.phone, email: s.email, website: s.website, address: s.address,
    bookingNotes: s.booking_notes, cancellation: s.cancellation_policy, paymentTerms: s.payment_terms,
    policies: (s.policies ?? {}) as Record<string, string>,
    verifiedAt: s.verified_at, verificationNotes: s.verification_notes, notes: s.notes, isActive: s.is_active,
    items: itemsBySupplier.get(s.id) ?? [],
  }));
}
