import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateLineItemPrice } from '@/lib/pricing';
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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

  const body = await request.json();
  if (!body.booking_id || !body.product_id) {
    return NextResponse.json({ error: 'booking_id and product_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch product to get default price and categories
  const { data: product } = await supabase
    .from('products')
    .select('base_price, currency')
    .eq('id', body.product_id)
    .single();

  // Fetch variant if specified
  let variantPrice: number | null = null;
  if (body.variant_id) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('price')
      .eq('id', body.variant_id)
      .single();
    variantPrice = variant?.price ?? null;
  }

  // Fetch product category slugs for tax matching
  const { data: catMaps } = await supabase
    .from('product_category_map')
    .select('product_categories:category_id ( slug )')
    .eq('product_id', body.product_id);

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

  const unitPrice = body.unit_price ?? variantPrice ?? product?.base_price ?? 0;
  const quantity = body.quantity ?? 1;
  const discountAmount = body.discount_amount ?? 0;
  const discountPercent = body.discount_percent ?? 0;

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
      booking_id: body.booking_id,
      product_id: body.product_id,
      variant_id: body.variant_id || null,
      person_id: body.person_id || null,
      provider_id: body.provider_id || null,
      facility_id: body.facility_id || null,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      tax_amount: pricing.totalTax,
      total_amount: pricing.total,
      currency: product?.currency ?? body.currency ?? 'USD',
      status: body.status ?? 'confirmed',
      scheduled_date: body.scheduled_date || null,
      scheduled_start: body.scheduled_start || null,
      scheduled_end: body.scheduled_end || null,
      notes: body.notes || null,
    })
    .select('id')
    .single();

  if (liError) {
    return NextResponse.json({ error: liError.message }, { status: 400 });
  }

  // Insert tax breakdown rows
  if (pricing.taxes.length > 0 && lineItem) {
    const taxRows = pricing.taxes.map((t) => ({
      line_item_id: lineItem.id,
      tax_rate_id: t.taxRateId,
      tax_name: t.name,
      tax_rate: t.rate,
      tax_amount: t.amount,
    }));
    await supabase.from('line_item_taxes').insert(taxRows);
  }

  return NextResponse.json({ success: true, id: lineItem!.id, pricing });
}

/**
 * PUT /api/admin/line-items — update a line item (status, approval, etc.)
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.staff_notes !== undefined) update.staff_notes = body.staff_notes;

  // Approval fields
  if (body.approved_signature !== undefined) {
    update.approved_signature = body.approved_signature;
    update.approved_at = body.approved_at ?? new Date().toISOString();
    update.approved_location_name = body.approved_location_name ?? null;
    update.approved_location_coords = body.approved_location_coords ?? null;
    update.approved_by_person_id = body.approved_by_person_id ?? null;
    update.approval_method = body.approval_method ?? 'staff_presented';
  }

  const { error } = await supabase
    .from('booking_line_items')
    .update(update)
    .eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
