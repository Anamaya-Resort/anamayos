import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { fetchWTTrips, fetchWTTransactions, fetchWTPaymentLinks } from '@/lib/wetravel';

/**
 * POST /api/admin/import/wetravel
 * Streaming import of WeTravel payments, trips, and payment links.
 * Matches payments to existing persons by email and links to bookings.
 */
export async function POST() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit: 3 imports per 10 minutes
  if (!checkRateLimit(`import:wt:${session.user.id}`, { limit: 3, windowSeconds: 600 })) {
    return new Response(JSON.stringify({ error: 'Too many import requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const supabase = createServiceClient();
      let errorCount = 0;

      function send(data: { step: string; status: string; detail?: string; count?: string }) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      }

      function sendError(step: string, msg: string) {
        errorCount++;
        send({ step, status: 'error', detail: msg });
      }

      try {
        // Build person lookup by email for matching
        const { data: allPersons } = await supabase.from('persons').select('id, email');
        const personByEmail = new Map<string, string>();
        for (const p of (allPersons ?? []) as Array<{ id: string; email: string }>) {
          personByEmail.set(p.email.toLowerCase(), p.id);
        }

        // ============================================================
        // 1. TRIPS → store as reference data
        // ============================================================
        send({ step: 'trips', status: 'fetching' });
        const wtTrips = await fetchWTTrips();
        send({ step: 'trips', status: 'done', count: `${wtTrips.length} trips found` });

        // Build trip lookup
        const tripByUuid = new Map<string, { title: string; start_date: string | null }>();
        for (const t of wtTrips) {
          tripByUuid.set(t.uuid, { title: t.title, start_date: t.start_date });
        }

        // ============================================================
        // 2. TRANSACTIONS → import as transactions linked to persons
        // ============================================================
        send({ step: 'transactions', status: 'fetching' });
        const wtTrans = await fetchWTTransactions();
        let transImported = 0;
        let transSkipped = 0;

        for (let i = 0; i < wtTrans.length; i++) {
          const tx = wtTrans[i];

          // Only import incoming payments, not payouts/wire transfers
          const isPayment = tx.type === 'Payment';

          // Map WeTravel type to our transaction enums
          let txClass: string;
          let txCategory: string;
          if (tx.type === 'Payment') {
            txClass = tx.payment_method === 'card' ? 'card_payment' : 'non_cc_payment';
            txCategory = 'payment';
          } else if (tx.type === 'Payout' || tx.type === 'Wire Transfer') {
            // Skip outgoing transfers — these aren't guest payments
            transSkipped++;
            continue;
          } else {
            txClass = 'non_cc_payment';
            txCategory = 'other_payment';
          }

          // Find person by buyer email or first participant email
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

          // If person not found, create them from buyer data
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

          // Try to match to a booking by person + date overlap with trip dates
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

          // Amount is in cents — convert to dollars
          const amountDollars = (tx.customer_facing_amount ?? tx.amount ?? 0) / 100;
          const netDollars = (tx.net_amount ?? 0) / 100;

          // Build description
          const desc = [
            tx.trip?.title ?? '',
            tx.packages?.map((p) => p.name).join(', ') ?? '',
            tx.description ?? '',
          ].filter(Boolean).join(' — ') || 'WeTravel Payment';

          // Upsert using WeTravel UUID as the dedup key
          // We use the wt_ prefix to avoid collision with RG transaction rg_ids
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
              tx.note || '',
            ].filter(Boolean).join(' | ') || null,
            gl_code: 'wetravel',
            currency: tx.currency ?? 'USD',
          }, { onConflict: 'rg_id' });

          if (error) {
            sendError('transactions', `${tx.uuid}: ${error.message}`);
          } else {
            transImported++;
          }

          if ((i + 1) % 5 === 0 || i === wtTrans.length - 1) {
            send({ step: 'transactions', status: 'importing', count: `${i + 1}/${wtTrans.length}` });
          }
        }
        send({ step: 'transactions', status: 'done', count: `${transImported} payments imported (${transSkipped} outgoing skipped)` });

        // ============================================================
        // 3. PAYMENT LINKS → log for reference
        // ============================================================
        send({ step: 'payment_links', status: 'fetching' });
        const wtLinks = await fetchWTPaymentLinks();
        send({ step: 'payment_links', status: 'done', count: `${wtLinks.length} payment links found` });

        // Done
        send({ step: 'complete', status: 'done', detail: `WeTravel sync complete. ${errorCount} errors.` });
      } catch (err) {
        console.error('[Import WT Error]', err instanceof Error ? err.message : err);
        send({ step: 'error', status: 'error', detail: 'Import failed — check server logs' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}

/** Simple string hash to integer for dedup (WT UUIDs → rg_id compatible int) */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit int
  }
  // Make negative to avoid collision with positive RG IDs
  return hash < 0 ? hash : -(hash + 1);
}
