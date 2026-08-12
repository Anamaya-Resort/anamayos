import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import {
  pushRetreatToRG,
  isPushGloballyEnabled,
  pricingPushRefusal,
  type PushableRetreat,
  type PricingTier,
} from '@/lib/retreat-guru-push';

const RETREAT_COLS =
  'id, rg_id, rg_push_enabled, name, start_date, end_date, description, max_capacity, package_nights, is_public, categories, pricing_type, pricing_model';

/**
 * GET /api/admin/retreats/{id}/push-rg
 * Preview only. Reports whether pushing is possible and what would be
 * sent. Never writes to Retreat Guru.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { id } = await ctx.params;

  const supabase = createServiceClient();
  const { data: retreat, error } = await supabase
    .from('retreats')
    .select(RETREAT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!retreat) return Response.json({ error: 'Retreat not found' }, { status: 404 });

  const tiers = await loadTiers(supabase, id);
  const result = await pushRetreatToRG(retreat as PushableRetreat, tiers);

  return Response.json({
    globallyEnabled: isPushGloballyEnabled(),
    retreatEnabled: (retreat as PushableRetreat).rg_push_enabled === true,
    hasRgId: (retreat as PushableRetreat).rg_id != null,
    pricingRefusal: pricingPushRefusal(retreat as PushableRetreat),
    ...result,
  });
}

/**
 * POST /api/admin/retreats/{id}/push-rg
 * Body: { mode?: 'dry_run' | 'live' }  — defaults to dry_run.
 *
 * A 'live' request still downgrades itself to a dry run unless every
 * gate is open (env switch, per-retreat switch, token, rg_id). Every
 * attempt is written to rg_push_log.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* empty body is fine — dry run */ }
  const requestedMode = body.mode === 'live' ? 'live' : 'dry_run';

  const supabase = createServiceClient();
  const { data: retreat, error } = await supabase
    .from('retreats')
    .select(RETREAT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!retreat) return Response.json({ error: 'Retreat not found' }, { status: 404 });

  const tiers = await loadTiers(supabase, id);
  const result = await pushRetreatToRG(retreat as PushableRetreat, tiers, { requestedMode });

  await supabase.from('rg_push_log').insert({
    retreat_id: id,
    rg_id: (retreat as PushableRetreat).rg_id,
    mode: result.mode,
    outcome: result.outcome,
    refused_reason: result.refusedReason ?? null,
    fields_sent: result.fieldsSent,
    payload: result.payload,
    response: result.response ?? {},
    pushed_by: session.personId ?? null,
  });

  return Response.json(result);
}

async function loadTiers(
  supabase: ReturnType<typeof createServiceClient>,
  retreatId: string,
): Promise<PricingTier[]> {
  const { data } = await supabase
    .from('retreat_pricing_tiers')
    .select('name, price, description')
    .eq('retreat_id', retreatId)
    .eq('is_active', true)
    .order('tier_order');
  return (data ?? []) as PricingTier[];
}
