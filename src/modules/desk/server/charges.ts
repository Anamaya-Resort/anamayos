import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateLineItemPrice } from '@/lib/pricing';
import type { TaxRate } from '@/types';
import { DESK_CONFIG } from '../config';
import { findConflict, freeRoom } from '../conflicts';
import { fromMinutes, todayIn, toMinutes } from '../time';
import type { DeskCharge } from '../types';
import { daySessions, listRooms, listTherapists } from './day';
import { effectivePrices } from './prices';

export class DeskError extends Error {
  constructor(public code: 'not_found' | 'provider_busy' | 'guest_busy' | 'room_busy' | 'outside_hours' | 'not_offered' | 'invalid', message?: string) {
    super(message ?? code);
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listCharges(bookingId: string): Promise<DeskCharge[]> {
  const { data, error } = await createServiceClient()
    .from('booking_line_items')
    .select(`id, quantity, unit_price, discount_amount, tax_amount, total_amount, tip_amount, status,
      scheduled_date, scheduled_start, scheduled_end, parent_line_item_id, created_at,
      products:product_id ( name ), provider:provider_id ( full_name )`)
    .eq('booking_id', bookingId)
    .neq('status', 'cancelled')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('scheduled_start', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const prod = r.products as unknown as { name: string } | null;
    const prov = r.provider as unknown as { full_name: string | null } | null;
    return {
      id: r.id, name: prod?.name ?? '', date: r.scheduled_date,
      start: r.scheduled_start?.slice(0, 5) ?? null, end: r.scheduled_end?.slice(0, 5) ?? null,
      providerName: prov?.full_name ?? null, quantity: r.quantity,
      net: round2(Number(r.total_amount) - Number(r.tax_amount)), tax: Number(r.tax_amount),
      tip: Number(r.tip_amount ?? 0), status: r.status, parentId: r.parent_line_item_id,
    };
  });
}

async function taxContext(productId: string) {
  const supabase = createServiceClient();
  const [{ data: rates }, { data: maps }] = await Promise.all([
    supabase.from('tax_rates').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('product_category_map').select('product_categories:category_id ( slug )').eq('product_id', productId),
  ]);
  const slugs = (maps ?? []).map((m) => (m.product_categories as unknown as { slug: string } | null)?.slug).filter(Boolean) as string[];
  return { rates: (rates ?? []) as TaxRate[], slugs };
}

interface LineInput {
  bookingId: string; personId: string; productId: string; providerId: string | null; facilityId?: string | null;
  unitPrice: number; quantity: number; tip: number; commission: number | null;
  date: string | null; start: string | null; end: string | null;
  parentId: string | null; bookedBy: string | null; status: 'scheduled' | 'completed';
}

async function insertLine(v: LineInput): Promise<string> {
  const supabase = createServiceClient();
  const { rates, slugs } = await taxContext(v.productId);
  const pricing = calculateLineItemPrice({ unitPrice: v.unitPrice, quantity: v.quantity, taxRates: rates, productCategorySlugs: slugs });
  const { data, error } = await supabase.from('booking_line_items').insert({
    booking_id: v.bookingId, product_id: v.productId, person_id: v.personId, provider_id: v.providerId, facility_id: v.facilityId ?? null,
    quantity: v.quantity, unit_price: v.unitPrice, discount_amount: 0, discount_percent: 0,
    tax_amount: pricing.totalTax, total_amount: pricing.total, tip_amount: round2(v.tip),
    commission_amount: v.commission == null ? null : round2(v.commission * v.quantity),
    currency: 'USD', status: v.status, scheduled_date: v.date, scheduled_start: v.start, scheduled_end: v.end,
    parent_line_item_id: v.parentId, booked_by_person_id: v.bookedBy,
  }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'insert failed');
  if (pricing.taxes.length) {
    const { error: taxErr } = await supabase.from('line_item_taxes').insert(pricing.taxes.map((t) => ({
      line_item_id: data.id, tax_rate_id: t.taxRateId, tax_name: t.name, tax_rate: t.rate, tax_amount: t.amount,
    })));
    if (taxErr) {
      await supabase.from('booking_line_items').delete().eq('id', data.id);
      throw new Error(taxErr.message);
    }
  }
  return data.id;
}

async function loadBooking(bookingId: string) {
  const { data } = await createServiceClient().from('bookings').select('id, person_id, status').eq('id', bookingId).maybeSingle();
  if (!data?.person_id || data.status === 'cancelled') throw new DeskError('not_found');
  return { id: data.id as string, personId: data.person_id as string };
}

export async function bookSpa(input: {
  bookingId: string; serviceId: string; providerId: string | null; roomId: string | null; date: string; start: string;
  addonServiceIds: string[]; tip: number; bookedBy: string | null;
}): Promise<string> {
  const supabase = createServiceClient();
  const booking = await loadBooking(input.bookingId);
  const ids = [input.serviceId, ...input.addonServiceIds];
  const { data: services } = await supabase
    .from('service_catalog').select('id, duration_minutes, price, commission_amount, is_addon, is_active').in('id', ids);
  const main = services?.find((s) => s.id === input.serviceId);
  const addons = (services ?? []).filter((s) => input.addonServiceIds.includes(s.id) && s.is_addon && s.is_active);
  if (!main?.is_active || main.is_addon || addons.length !== input.addonServiceIds.length) throw new DeskError('invalid');

  // Small team: anyone on the spa team may do any treatment.
  if (input.providerId && !(await listTherapists()).some((t) => t.personId === input.providerId)) throw new DeskError('not_offered');

  const start = toMinutes(input.start);
  const end = start + main.duration_minutes + addons.reduce((n, a) => n + a.duration_minutes, 0);
  if (start < toMinutes(DESK_CONFIG.spaOpen) || end > toMinutes(DESK_CONFIG.spaClose)) throw new DeskError('outside_hours');

  const [sessions, rooms] = await Promise.all([daySessions(input.date), listRooms()]);
  const roomIds = rooms.map((r) => r.id);
  if (input.roomId && !roomIds.includes(input.roomId)) throw new DeskError('invalid');
  const roomId = input.roomId ?? freeRoom(sessions, roomIds, start, end);
  if (roomIds.length && !roomId) throw new DeskError('room_busy');
  const clash = findConflict(sessions, { start, end, therapistId: input.providerId, roomId, personId: booking.personId });
  if (clash) throw new DeskError(clash);

  const prices = await effectivePrices(services ?? [], input.date);
  const { data: products } = await supabase.from('products').select('id, service_catalog_id').in('service_catalog_id', ids);
  const productOf = (sid: string) => {
    const p = products?.find((x) => x.service_catalog_id === sid);
    if (!p) throw new DeskError('invalid');
    return p.id as string;
  };
  const base = { bookingId: booking.id, personId: booking.personId, providerId: input.providerId, facilityId: roomId, quantity: 1, bookedBy: input.bookedBy, status: 'scheduled' as const };
  const parentId = await insertLine({
    ...base, productId: productOf(main.id), unitPrice: prices.get(main.id)!.price, commission: prices.get(main.id)!.commission,
    tip: input.tip, date: input.date, start: fromMinutes(start), end: fromMinutes(end), parentId: null,
  });
  for (const a of addons) {
    await insertLine({
      ...base, productId: productOf(a.id), unitPrice: prices.get(a.id)!.price, commission: prices.get(a.id)!.commission,
      tip: 0, date: input.date, start: null, end: null, parentId,
    });
  }
  return parentId;
}

export async function chargeItem(input: { bookingId: string; productId: string; quantity: number; tip: number; bookedBy: string | null }): Promise<string> {
  const booking = await loadBooking(input.bookingId);
  const { data: p } = await createServiceClient().from('products').select('id, base_price, is_active, service_catalog_id').eq('id', input.productId).maybeSingle();
  if (!p?.is_active || p.service_catalog_id) throw new DeskError('invalid');
  return insertLine({
    bookingId: booking.id, personId: booking.personId, productId: p.id, providerId: null,
    unitPrice: Number(p.base_price ?? 0), quantity: input.quantity, tip: input.tip, commission: null,
    date: todayIn(DESK_CONFIG.timezone), start: null, end: null, parentId: null, bookedBy: input.bookedBy, status: 'completed',
  });
}

/** Cancels a charge and any add-ons attached to it. */
export async function cancelCharge(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('booking_line_items').update({ status: 'cancelled' }).or(`id.eq.${id},parent_line_item_id.eq.${id}`);
  if (error) throw new Error(error.message);
}
