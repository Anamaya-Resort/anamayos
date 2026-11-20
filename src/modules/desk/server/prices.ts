import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface EffectivePrice {
  price: number;
  commission: number | null;
}

/**
 * Price and commission of each service ON a given date: today's
 * service_catalog value, overridden by the latest scheduled change
 * (service_price_changes) dated on or before that day. So a treatment
 * booked today for Dec 6 is charged at the Dec 5 price.
 */
export async function effectivePrices(
  services: { id: string; price: number; commission_amount: number | null }[],
  date: string,
): Promise<Map<string, EffectivePrice>> {
  const out = new Map<string, EffectivePrice>();
  for (const s of services) out.set(s.id, { price: Number(s.price), commission: s.commission_amount == null ? null : Number(s.commission_amount) });
  if (!services.length) return out;

  const { data } = await createServiceClient()
    .from('service_price_changes')
    .select('service_id, new_price, new_commission_amount, effective_date')
    .is('applied_at', null)
    .lte('effective_date', date)
    .in('service_id', services.map((s) => s.id))
    .order('effective_date', { ascending: true });

  for (const c of data ?? []) {
    const prev = out.get(c.service_id);
    out.set(c.service_id, {
      price: Number(c.new_price),
      commission: c.new_commission_amount == null ? (prev?.commission ?? null) : Number(c.new_commission_amount),
    });
  }
  return out;
}
