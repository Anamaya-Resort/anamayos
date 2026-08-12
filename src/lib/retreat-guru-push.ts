/**
 * Retreat Guru push — AO as the author, RG as a downstream copy.
 *
 * PREPARED BUT OFF. Two independent switches must both be on before
 * anything is sent:
 *   1. RG_PUSH_ENABLED=true in the environment (server-wide kill switch)
 *   2. retreats.rg_push_enabled = true on the individual retreat
 * Absent either, every call returns a dry run: the payload we WOULD
 * have sent, and no network write.
 *
 * What Retreat Guru actually lets us write (from its OpenAPI spec at
 * /api/v1/swagger.json, read 2026-Aug-12):
 *   POST /programs/{id}/update  — name, dates, content, capacity,
 *     public, categories, package_nights, external_code, and
 *     pricing_options (TIERED SHAPE ONLY).
 *   GET  /lodgings              — read-only. No write endpoint exists.
 *
 * THE PRICING TRAP: RG's own field docs say pricing_type "currently
 * only `tiered` is supported". Anamaya prices nearly everything
 * per-room (`pricing_type = 'lodging'`), where each room carries its
 * own price. Pushing pricing_options to a lodging-priced program would
 * flatten it to a tiered list and destroy room-level booking. There is
 * no API path that writes per-room prices. So: we refuse to push
 * pricing for anything that is not already tiered, and we never send
 * pricing_type at all. Non-pricing fields are still safe to push.
 */

const RG_BASE_URL = process.env.RG_API_URL ?? 'https://anamaya.secure.retreat.guru/api/v1';
const RG_TOKEN = process.env.RG_API_TOKEN ?? '';
const PUSH_TIMEOUT_MS = 30_000;

/** Server-wide kill switch. Off unless explicitly set to the string "true". */
export function isPushGloballyEnabled(): boolean {
  return process.env.RG_PUSH_ENABLED === 'true';
}

export type PushMode = 'dry_run' | 'live';

export interface PushOutcome {
  mode: PushMode;
  outcome: 'ok' | 'refused' | 'error';
  refusedReason?: string;
  /** Field names included in the payload, for the audit log. */
  fieldsSent: string[];
  payload: Record<string, unknown>;
  response?: unknown;
  /** Human-readable notes about anything deliberately withheld. */
  warnings: string[];
}

/** The AO retreat shape this module needs. Deliberately narrow. */
export interface PushableRetreat {
  id: string;
  rg_id: number | null;
  rg_push_enabled: boolean | null;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  max_capacity: number | null;
  package_nights: number | null;
  is_public: boolean | null;
  categories: string[] | null;
  pricing_type: string | null;
  pricing_model: string | null;
}

export interface PricingTier {
  name: string | null;
  price: number | string | null;
  description: string | null;
}

/**
 * Decide whether this retreat's PRICES may be pushed.
 * Only tiered pricing is representable in RG's write API; anything
 * else would be a destructive conversion.
 */
export function pricingPushRefusal(retreat: PushableRetreat): string | null {
  const type = (retreat.pricing_type ?? '').toLowerCase();
  const model = (retreat.pricing_model ?? '').toLowerCase();
  if (type === 'lodging') {
    return 'Priced per room (lodging). Retreat Guru has no API to write per-room prices, and sending pricing would flatten the retreat to a single tiered list, breaking room selection at booking.';
  }
  if (model === 'dynamic_plus') {
    return 'Uses Dynamic+ bonding-curve pricing, which Retreat Guru cannot represent.';
  }
  if (type !== 'tiered' && model !== 'tiered') {
    return `Pricing type "${retreat.pricing_type ?? 'unset'}" is not tiered; Retreat Guru only accepts tiered pricing over the API.`;
  }
  return null;
}

/**
 * Build the RG program payload from an AO retreat.
 * Only includes fields that are set, so a push never blanks a value in
 * RG that AO happens not to know about.
 */
export function buildProgramPayload(
  retreat: PushableRetreat,
  tiers: PricingTier[] | null,
): { payload: Record<string, unknown>; warnings: string[] } {
  const payload: Record<string, unknown> = {};
  const warnings: string[] = [];

  if (retreat.name) payload.name = retreat.name;
  if (retreat.start_date) payload.start_date = retreat.start_date;
  if (retreat.end_date) payload.end_date = retreat.end_date;
  if (retreat.description) payload.content = retreat.description;
  if (retreat.max_capacity != null) payload.max_capacity = retreat.max_capacity;
  if (retreat.package_nights != null) payload.package_nights = retreat.package_nights;
  if (retreat.is_public != null) payload.public = retreat.is_public;
  if (retreat.categories?.length) payload.categories = retreat.categories;

  // Pricing: only when it is safely representable.
  const refusal = pricingPushRefusal(retreat);
  if (refusal) {
    warnings.push(`Prices NOT pushed. ${refusal}`);
  } else if (tiers?.length) {
    payload.pricing_options = tiers.map((t) => ({
      price: String(Number(t.price) || 0),
      description: t.description || t.name || '',
    }));
  } else {
    warnings.push('Prices not pushed: retreat is tiered but has no pricing tiers set in AnamayOS.');
  }

  // Never sent, on purpose:
  warnings.push('pricing_type is never sent — changing it in Retreat Guru would alter how guests book.');

  return { payload, warnings };
}

/**
 * Push a retreat to Retreat Guru, or (by default) work out what the
 * push WOULD do without sending anything.
 *
 * Returns rather than throws, so the caller can always write an audit
 * row describing what happened.
 */
export async function pushRetreatToRG(
  retreat: PushableRetreat,
  tiers: PricingTier[] | null,
  opts: { requestedMode?: PushMode } = {},
): Promise<PushOutcome> {
  const { payload, warnings } = buildProgramPayload(retreat, tiers);
  const fieldsSent = Object.keys(payload);

  // Work out whether this is allowed to be a real send.
  const blockers: string[] = [];
  if (!isPushGloballyEnabled()) blockers.push('RG_PUSH_ENABLED is not set to true on the server');
  if (!retreat.rg_push_enabled) blockers.push('"Push to Retreat Guru" is off for this retreat');
  if (!RG_TOKEN) blockers.push('RG_API_TOKEN is not configured');
  if (retreat.rg_id == null) blockers.push('This retreat has no Retreat Guru ID to update');

  const wantsLive = opts.requestedMode === 'live';
  const mode: PushMode = wantsLive && blockers.length === 0 ? 'live' : 'dry_run';

  if (mode === 'dry_run') {
    return {
      mode,
      outcome: wantsLive ? 'refused' : 'ok',
      refusedReason: wantsLive ? blockers.join('; ') : undefined,
      fieldsSent,
      payload,
      warnings,
    };
  }

  if (fieldsSent.length === 0) {
    return { mode, outcome: 'refused', refusedReason: 'Nothing to send', fieldsSent, payload, warnings };
  }

  const url = `${RG_BASE_URL}/programs/${retreat.rg_id}/update?token=${encodeURIComponent(RG_TOKEN)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program: payload }),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw text */ }
    if (!res.ok) {
      return { mode, outcome: 'error', refusedReason: `RG returned ${res.status}`, fieldsSent, payload, response: parsed, warnings };
    }
    return { mode, outcome: 'ok', fieldsSent, payload, response: parsed, warnings };
  } catch (e) {
    return { mode, outcome: 'error', refusedReason: (e as Error).message, fieldsSent, payload, warnings };
  } finally {
    clearTimeout(timer);
  }
}
