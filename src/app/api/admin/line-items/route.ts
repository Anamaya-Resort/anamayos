import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateLineItemPrice } from '@/lib/pricing';
import { createLineItemSchema, updateLineItemSchema } from '@/lib/api-schemas';
import { dbError, validationError } from '@/lib/api-utils';
import type { TaxRate } from '@/types';

/**
 * GET /api/admin/line-items?booking_id=...
 * Returns line items with joined product info and taxes.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get('booking_id');
  if (!bookingId) {
    return NextResponse.json({ error: 'booking_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: items, error } = await supabase
    .from('booking_line_items')
    .select(`
      *,
      products:product_id ( name, slug ),
      variants:variant_id ( name ),
      line_item_taxes ( * )
    `)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) return dbError(error);

  // Flatten joined data
  const result = (items ?? []).map((item) => {
    const prod = item.products as { name: string; slug: string } | null;
    const variant = item.variants as { name: string } | null;
    return {
      ...item,
      product_name: prod?.name ?? '',
      variant_name: variant?.name ?? null,
      taxes: item.line_item_taxes ?? [],
      products: undefined,
      variants: undefined,
      line_item_taxes: undefined,
    };
  });

  return NextResponse.json(result);
}

/**
 * POST /api/admin/line-items — create a line item with auto tax calculation
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createLineItemSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  // Fetch product to get default price and categories
  const { data: product } = await supabase
    .from('products')
    .select('base_price, currency')
    .eq('id', v.product_id)
    .single();

  // Fetch variant if specified
  let variantPrice: number | null = null;
  if (v.variant_id) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('price')
      .eq('id', v.variant_id)
      .single();
    variantPrice = variant?.price ?? null;
  }

  // Fetch product category slugs for tax matching
  const { data: catMaps } = await supabase
    .from('product_category_map')
    .select('product_categories:category_id ( slug )')
    .eq('product_id', v.product_id);

  const categorySlugs = (catMaps ?? [])
    .map((m) => {
      const cat = m.product_categories as unknown as { slug: string } | null;
      return cat?.slug;
    })
    .filter(Boolean) as string[];

  // Fetch active tax rates
  const { data: taxRates } = await supabase
    .from('tax_rates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  const unitPrice = Number(v.unit_price ?? variantPrice ?? product?.base_price ?? 0);
  const quantity = v.quantity;
  const discountAmount = v.discount_amount;
  const discountPercent = v.discount_percent;

  const pricing = calculateLineItemPrice({
    unitPrice,
    quantity,
    discountAmount,
    discountPercent,
    taxRates: (taxRates ?? []) as TaxRate[],
    productCategorySlugs: categorySlugs,
  });

  // Insert line item
  const { data: lineItem, error: liError } = await supabase
    .from('booking_line_items')
    .insert({
      booking_id: v.booking_id,
      product_id: v.product_id,
      variant_id: v.variant_id || null,
      person_id: v.person_id || null,
      provider_id: v.provider_id || null,
      facility_id: v.facility_id || null,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      tax_amount: pricing.totalTax,
      total_amount: pricing.total,
      currency: product?.currency ?? v.currency ?? 'USD',
      status: v.status,
      scheduled_date: v.scheduled_date || null,
      scheduled_start: v.scheduled_start || null,
      scheduled_end: v.scheduled_end || null,
      notes: v.notes || null,
    })
    .select('id')
    .single();

  if (liError) return dbError(liError);

  if (!lineItem) {
    return NextResponse.json({ error: 'Failed to create line item' }, { status: 500 });
  }

  // Insert tax breakdown rows
  if (pricing.taxes.length > 0) {
    const taxRows = pricing.taxes.map((t) => ({
      line_item_id: lineItem.id,
      tax_rate_id: t.taxRateId,
      tax_name: t.name,
      tax_rate: t.rate,
      tax_amount: t.amount,
    }));
    const { error: taxError } = await supabase.from('line_item_taxes').insert(taxRows);
    if (taxError) {
      // Line item exists but taxes failed — delete the orphan
      await supabase.from('booking_line_items').delete().eq('id', lineItem.id);
      return dbError(taxError);
    }
  }

  return NextResponse.json({ success: true, id: lineItem.id, pricing });
}

/**
 * PUT /api/admin/line-items — update a line item (status, approval, etc.)
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateLineItemSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};
  if (v.status !== undefined) update.status = v.status;
  if (v.notes !== undefined) update.notes = v.notes;
  if (v.staff_notes !== undefined) update.staff_notes = v.staff_notes;

  // Approval fields
  if (v.approved_signature !== undefined) {
    update.approved_signature = v.approved_signature;
    update.approved_at = v.approved_at ?? new Date().toISOString();
    update.approved_location_name = v.approved_location_name ?? null;
    update.approved_location_coords = v.approved_location_coords ?? null;
    update.approved_by_person_id = v.approved_by_person_id ?? null;
    update.approval_method = v.approval_method ?? 'staff_presented';
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('booking_line_items')
    .update(update)
    .eq('id', v.id);

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
