import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWTTransactions } from '@/lib/wetravel';

export type WeTravelImportResult = {
  imported: number;
  total: number;
  skipped: number;
  errors: string[];
};

/**
 * Core WeTravel transaction upsert -- shared by the full streaming import
 * (Settings page) and the quick combined sync (dashboard banner), so
 * there is exactly one place that decides how a WeTravel transaction
 * becomes a row, and both paths can never drift out of sync with each
 * other. `onProgress` is optional so the dashboard's quick path can call
 * this silently.
 *
 * WeTravel's API has no "since" filter, so every call returns the FULL
 * transaction history -- but only transactions not already in `transactions`
 * (by merchant_trans_id) go through the per-row work below (person lookup/
 * creation, booking-match query, upsert). Re-processing everything on every
 * run, every time, against an ever-growing history was almost certainly
 * what made this route exceed Vercel's default function timeout and die
 * silently mid-run -- the exact "click Update, nothing happens, still says
 * 107" symptom. Skipping known rows keeps each run's real work bounded to
 * what's actually new.
 */
export async function importWeTravelTransactions(
  supabase: SupabaseClient,
  onProgress?: (imported: number, total: number) => void,
): Promise<WeTravelImportResult> {
  const [{ data: allPersons }, { data: knownRows }] = await Promise.all([
    supabase.from('persons').select('id, email'),
    supabase
      .from('transactions')
      .select('merchant_trans_id')
      .eq('merchant_name', 'WeTravel')
      .not('merchant_trans_id', 'is', null),
  ]);
  const personByEmail = new Map<string, string>();
  for (const p of (allPersons ?? []) as Array<{ id: string; email: string }>) {
    personByEmail.set(p.email.toLowerCase(), p.id);
  }
  const known = new Set(
    ((knownRows ?? []) as Array<{ merchant_trans_id: string | null }>).map((r) => r.merchant_trans_id),
  );

  const allTrans = await fetchWTTransactions();
  const wtTrans = allTrans.filter((t) => !known.has(t.uuid));
  const skipped = allTrans.length - wtTrans.length;
  let transImported = 0;
  const errors: string[] = [];

  for (let i = 0; i < wtTrans.length; i++) {
    const tx = wtTrans[i];

    let txClass: string;
    let txCategory: string;
    if (tx.type === 'Payment') {
      txClass = tx.payment_method === 'card' ? 'card_payment' : 'non_cc_payment';
      txCategory = 'payment';
    } else if (tx.type === 'Payout') {
      txClass = 'payout';
      txCategory = 'payout';
    } else if (tx.type === 'Wire Transfer') {
      txClass = 'wire_transfer';
      txCategory = 'payout';
    } else {
      txClass = 'non_cc_payment';
      txCategory = 'other_payment';
    }

    let personId: string | null = null;
    const buyerEmail = tx.buyer?.email?.toLowerCase();
    if (buyerEmail) {
      personId = personByEmail.get(buyerEmail) ?? null;
    }
    if (!personId && tx.participants?.length > 0) {
      for (const p of tx.participants) {
        const pEmail = p.email?.toLowerCase();
        if (pEmail) {
          personId = personByEmail.get(pEmail) ?? null;
          if (personId) break;
        }
      }
    }

    if (!personId && tx.buyer?.email) {
      const email = tx.buyer.email.toLowerCase().trim();
      const { data: newPerson } = await supabase
        .from('persons')
        .insert({
          email,
          full_name: `${tx.buyer.first_name ?? ''} ${tx.buyer.last_name ?? ''}`.trim() || null,
        })
        .select('id')
        .single();
      if (newPerson) {
        personId = newPerson.id;
        personByEmail.set(email, newPerson.id);
      }
    }

    let bookingId: string | null = null;
    if (personId && tx.trip?.start_date) {
      const { data: matchedBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('person_id', personId)
        .lte('check_in', tx.trip.start_date)
        .gte('check_out', tx.trip.start_date)
        .limit(1)
        .single();
      bookingId = matchedBooking?.id ?? null;
    }

    const isPayout = txClass === 'payout' || txClass === 'wire_transfer';
    const amountDollars = (tx.customer_facing_amount ?? tx.amount ?? 0) / 100;
    const netDollars = (tx.net_amount ?? 0) / 100;
    const feeDollars = (tx.wetravel_fee ?? 0) / 100 + (tx.organizer_card_fee ?? 0) / 100;

    const typeLabel = isPayout ? (tx.type === 'Wire Transfer' ? 'Wire Transfer' : 'Payout') : 'Payment';
    const desc = [
      isPayout ? `WeTravel ${typeLabel}` : '',
      tx.trip?.title ?? '',
      tx.packages?.map((p) => p.name).join(', ') ?? '',
      tx.description ?? '',
    ].filter(Boolean).join(' — ') || `WeTravel ${typeLabel}`;

    const wtIdHash = hashStringToInt(tx.uuid);

    const { error } = await supabase.from('transactions').upsert({
      rg_id: wtIdHash,
      submitted_at: tx.created_at,
      trans_date: tx.created_at,
      class: txClass,
      category: txCategory,
      status: tx.status === 'processed' ? 'complete' : tx.status,
      description: desc,
      person_id: personId,
      booking_id: bookingId,
      charge_amount: 0,
      credit_amount: amountDollars,
      grand_total: amountDollars,
      subtotal: netDollars,
      fund_method: tx.payment_method ?? 'wetravel',
      merchant_name: 'WeTravel',
      merchant_trans_id: tx.uuid,
      notes: [
        tx.buyer ? `Buyer: ${tx.buyer.first_name} ${tx.buyer.last_name} (${tx.buyer.email})` : '',
        tx.discount_code ? `Discount: ${tx.discount_code}` : '',
        tx.brand && tx.last4 ? `Card: ${tx.brand} ****${tx.last4}` : '',
        feeDollars > 0 ? `Fees: $${feeDollars.toFixed(2)}` : '',
        tx.note || '',
      ].filter(Boolean).join(' | ') || null,
      gl_code: 'wetravel',
      currency: tx.currency ?? 'USD',
    }, { onConflict: 'rg_id' });

    if (error) {
      errors.push(`${tx.uuid}: ${error.message}`);
    } else {
      transImported++;
    }

    onProgress?.(i + 1, wtTrans.length);
  }

  return { imported: transImported, total: wtTrans.length, skipped, errors };
}

/** Simple string hash to integer for dedup (WT UUIDs -> rg_id compatible int) */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash < 0 ? hash : -(hash + 1);
}
