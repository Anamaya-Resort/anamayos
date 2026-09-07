import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { SyncJob } from '@/lib/sync-job';
import { fetchWTTrips, fetchWTPaymentLinks } from '@/lib/wetravel';
import { importWeTravelTransactions } from '@/lib/wetravel-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

      const job = new SyncJob(supabase, 'wetravel', 'full');
      await job.create();

      function send(data: { step: string; status: string; detail?: string; count?: string }) {
        try { controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')); } catch { /* client disconnected */ }
        job.send(data);
      }

      function sendError(step: string, msg: string) {
        errorCount++;
        try { controller.enqueue(encoder.encode(JSON.stringify({ step, status: 'error', detail: msg }) + '\n')); } catch { /* client disconnected */ }
        job.sendError(step, msg);
      }

      try {
        // ============================================================
        // 1. TRIPS → store as reference data
        // ============================================================
        send({ step: 'trips', status: 'fetching' });
        const wtTrips = await fetchWTTrips();
        send({ step: 'trips', status: 'done', count: `${wtTrips.length} trips found` });

        // ============================================================
        // 2. TRANSACTIONS → import as transactions linked to persons
        // ============================================================
        send({ step: 'transactions', status: 'fetching' });
        const result = await importWeTravelTransactions(supabase, (imported, total) => {
          if (imported % 5 === 0 || imported === total) {
            send({ step: 'transactions', status: 'importing', count: `${imported}/${total}` });
          }
        });
        for (const e of result.errors) sendError('transactions', e);
        send({ step: 'transactions', status: 'done', count: `${result.imported}/${result.total} imported` });

        // ============================================================
        // 3. PAYMENT LINKS → log for reference
        // ============================================================
        send({ step: 'payment_links', status: 'fetching' });
        const wtLinks = await fetchWTPaymentLinks();
        send({ step: 'payment_links', status: 'done', count: `${wtLinks.length} payment links found` });

        // Done
        send({ step: 'complete', status: 'done', detail: `WeTravel sync complete. ${errorCount} errors.` });
        await job.complete();
      } catch (err) {
        console.error('[Import WT Error]', err instanceof Error ? err.message : err);
        send({ step: 'error', status: 'error', detail: 'Import failed — check server logs' });
        await job.fail('Import failed — check server logs');
      } finally {
        try { controller.close(); } catch { /* already closed */ }
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
