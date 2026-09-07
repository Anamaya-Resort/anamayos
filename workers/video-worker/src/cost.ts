/**
 * Write the AI cost ledger.
 *
 * Every call already computed its own cost and then threw the number
 * away into a column nothing displayed. video_cost_ledger existed
 * from migration 00041 and had never been written to, so there was no
 * way to answer "what did tagging that folder cost" and no basis for
 * a spend cap.
 *
 * Amounts are micro-cents (cents x 10,000): a single image costs well
 * under a cent on every current model, so whole cents cannot
 * represent this workload.
 */
import { db } from './db.js';
import { log } from './log.js';

export async function recordCost(entry: {
  orgId: string;
  kind: 'vision' | 'transcript' | 'embed' | 'script' | 'edit' | 'caption' | 'render';
  microCents: number;
  refId?: string;
  modelEndpoint?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
}): Promise<void> {
  try {
    await db()
      .from('video_cost_ledger')
      .insert({
        org_id: entry.orgId,
        kind: entry.kind,
        // Legacy int column, kept in sync but no longer authoritative.
        cents: Math.round(entry.microCents / 10_000),
        micro_cents: entry.microCents,
        ref_id: entry.refId ?? null,
        model_endpoint: entry.modelEndpoint ?? null,
        input_tokens: entry.inputTokens ?? null,
        output_tokens: entry.outputTokens ?? null,
        cached_tokens: entry.cachedTokens ?? null,
      });
  } catch (err) {
    // Accounting must never fail the work it is accounting for.
    log.warn({ err: String(err) }, 'cost ledger write failed');
  }
}

/** Spend today, in micro-cents. Drives the daily cap. */
export async function spentTodayMicroCents(orgId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data } = await db()
    .from('video_cost_ledger')
    .select('micro_cents')
    .eq('org_id', orgId)
    .gte('occurred_at', since.toISOString())
    .limit(100000);
  let total = 0;
  for (const r of (data ?? []) as { micro_cents: number | null }[]) {
    total += r.micro_cents ?? 0;
  }
  return total;
}

/**
 * True when the org has already spent its daily AI allowance.
 * video_org_quotas.ai_cents_per_day_cap defaults to 500 ($5/day).
 */
export async function overDailyCap(orgId: string): Promise<boolean> {
  const { data } = await db()
    .from('video_org_quotas')
    .select('ai_cents_per_day_cap')
    .eq('org_id', orgId)
    .maybeSingle();
  const capCents = data?.ai_cents_per_day_cap;
  if (capCents == null) return false;
  return (await spentTodayMicroCents(orgId)) >= capCents * 10_000;
}
