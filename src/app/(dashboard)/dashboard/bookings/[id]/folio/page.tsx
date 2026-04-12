import { notFound } from 'next/navigation';
import { FolioView } from '@/modules/folio';
import { getDictionary } from '@/i18n';
import { getSession, getSessionLocale } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import type { FolioLineItem, FolioSummary } from '@/types';
import type { Locale } from '@/config/app';

export const metadata = { title: 'Guest Folio — AO Platform' };

export default async function FolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: bookingId } = await params;
  const [session, locale] = await Promise.all([getSession(), getSessionLocale()]);
  const dict = getDictionary(locale as Locale);

  if (!session?.personId) notFound();

  const supabase = createServiceClient();

  // Fetch booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, reference_code, check_in, check_out, currency, person_id')
    .eq('id', bookingId)
    .single();

  if (!booking) notFound();

  // Auth check: owner or staff+
  const isOwner = booking.person_id === session.personId;
  const isStaff = (session.accessLevel ?? 0) >= 3;
  if (!isOwner && !isStaff) notFound();

  // Fetch guest name
  const { data: person } = await supabase
    .from('persons')
    .select('full_name')
    .eq('id', booking.person_id)
    .single();

  // Fetch line items with products and taxes
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

  const lineItems: FolioLineItem[] = (items ?? []).map((item) => {
    const prod = item.products as { name: string; slug: string } | null;
    const variant = item.variants as { name: string } | null;
    return {
      ...item,
      product_name: prod?.name ?? '',
      variant_name: variant?.name ?? null,
      category_slugs: [],
      taxes: item.line_item_taxes ?? [],
    } as FolioLineItem;
  });

  // Fetch payments
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
  const subtotal = lineItems.reduce(
    (sum, li) => sum + (li.unit_price * li.quantity - li.discount_amount - li.unit_price * li.quantity * li.discount_percent / 100),
    0,
  );
  const totalTax = lineItems.reduce((sum, li) => sum + li.tax_amount, 0);
  const grandTotal = lineItems.reduce((sum, li) => sum + li.total_amount, 0);

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

  return (
    <FolioView
      booking={booking}
      guestName={person?.full_name ?? 'Guest'}
      lineItems={lineItems}
      summary={summary}
      dict={dict}
      canApprove={isOwner}
      personId={session.personId}
    />
  );
}
