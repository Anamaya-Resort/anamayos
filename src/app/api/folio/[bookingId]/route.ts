import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { FolioSummary } from '@/types';

/**
 * GET /api/folio/[bookingId] — guest-accessible folio
 * Access level >= 1, but must own the booking OR be staff+
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const session = await getSession();
  if (!session?.personId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { bookingId } = await params;
  const supabase = createServiceClient();

  // Verify ownership or staff access
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, person_id, reference_code, check_in, check_out, currency')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const isOwner = booking.person_id === session.personId;
  const isStaff = (session.accessLevel ?? 0) >= 3;
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Fetch line items with product info and taxes
  const { data: items } = await supabase
    .from('booking_line_items')
    .select(`
      *,
      products:product_id ( name, slug ),
      variants:variant_id ( name ),
      line_item_taxes ( * )
    `)
    .eq('booking_id', bookingId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });

  const lineItems = (items ?? []).map((item) => {
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

  // Fetch payments from transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('credit_amount')
    .eq('booking_id', bookingId)
    .in('class', ['card_payment', 'non_cc_payment']);

  const paymentsApplied = (transactions ?? []).reduce(
    (sum, t) => sum + (Number(t.credit_amount) || 0),
    0,
  );

  // Build summary
  const subtotal = lineItems.reduce((sum, li) => sum + (li.unit_price * li.quantity - li.discount_amount - li.unit_price * li.quantity * li.discount_percent / 100), 0);
  const totalTax = lineItems.reduce((sum, li) => sum + li.tax_amount, 0);
  const grandTotal = lineItems.reduce((sum, li) => sum + li.total_amount, 0);

  // Group taxes by name
  const taxMap = new Map<string, number>();
  for (const li of lineItems) {
    for (const tax of li.taxes) {
      taxMap.set(tax.tax_name, (taxMap.get(tax.tax_name) ?? 0) + tax.tax_amount);
    }
  }

  const summary: FolioSummary = {
    subtotal: Math.round(subtotal * 100) / 100,
    taxBreakdown: Array.from(taxMap.entries()).map(([name, total]) => ({ name, total })),
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    paymentsApplied: Math.round(paymentsApplied * 100) / 100,
    balanceDue: Math.round((grandTotal - paymentsApplied) * 100) / 100,
  };

  return NextResponse.json({ booking, lineItems, summary });
}
