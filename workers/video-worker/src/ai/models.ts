/**
 * Which model does which job, read from video_maker_model_roles.
 *
 * This replaces two hardcodes. The image path pinned
 * claude-sonnet-4-6 in ai/vision.ts, and the video path chose Gemini
 * purely because GEMINI_API_KEY happened to be set - so adding that
 * key for one reason silently changed the model for another, and
 * neither choice was visible or changeable without a redeploy.
 *
 * Roles now come from a database row. Changing the vision model is an
 * UPDATE, and the price used for the cost ledger travels with it, so
 * the two can never drift apart.
 */
import { db } from '../db.js';

export type RoleName =
  | 'vision'
  | 'caption'
  | 'script'
  | 'edit'
  | 'embed'
  | 'transcript';

export type ModelRole = {
  role: RoleName;
  providerId: string;
  modelEndpoint: string;
  inputPerMTok: number;
  outputPerMTok: number;
  cachedInputPerMTok: number | null;
  supportsBatch: boolean;
};

/**
 * Short on purpose. Long enough that a bulk run does not query per
 * image, short enough that changing the row takes effect within a
 * minute without a redeploy - which is the whole point of the table.
 */
const TTL_MS = 60_000;

/** Matches migration 00049's seed, for the window before it is applied. */
const FALLBACK: Record<string, Omit<ModelRole, 'role'>> = {
  vision: {
    providerId: 'google',
    modelEndpoint: 'gemini-2.5-flash',
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
    cachedInputPerMTok: 0.03,
    supportsBatch: true,
  },
  caption: {
    providerId: 'anthropic',
    modelEndpoint: 'claude-sonnet-5',
    inputPerMTok: 2,
    outputPerMTok: 10,
    cachedInputPerMTok: 0.2,
    supportsBatch: true,
  },
};

const cache = new Map<string, { role: ModelRole; expiresAt: number }>();

export async function getModelRole(
  orgId: string,
  role: RoleName,
): Promise<ModelRole> {
  const id = `${orgId}:${role}`;
  const hit = cache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.role;

  const { data } = await db()
    .from('video_maker_model_roles')
    .select(
      'provider_id, model_endpoint, input_per_mtok_usd, output_per_mtok_usd, cached_input_per_mtok_usd, supports_batch',
    )
    .eq('org_id', orgId)
    .eq('role', role)
    .maybeSingle();

  const fb = FALLBACK[role] ?? FALLBACK.vision;
  const resolved: ModelRole = data
    ? {
        role,
        providerId: data.provider_id,
        modelEndpoint: data.model_endpoint,
        inputPerMTok: Number(data.input_per_mtok_usd ?? fb.inputPerMTok),
        outputPerMTok: Number(data.output_per_mtok_usd ?? fb.outputPerMTok),
        cachedInputPerMTok:
          data.cached_input_per_mtok_usd == null
            ? null
            : Number(data.cached_input_per_mtok_usd),
        supportsBatch: !!data.supports_batch,
      }
    : { role, ...fb };

  cache.set(id, { role: resolved, expiresAt: Date.now() + TTL_MS });
  return resolved;
}

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

/**
 * Cost in micro-cents (cents x 10,000).
 *
 * The old code did Math.ceil() into an int-cents column, so a
 * $0.002 image was booked as a whole cent and a 20,000 image run
 * overstated its own spend roughly fivefold. Every current model
 * prices a single image below one cent, so whole cents cannot
 * represent this workload at all.
 */
export function microCents(role: ModelRole, u: Usage): number {
  const cachedRate = role.cachedInputPerMTok ?? role.inputPerMTok;
  const usd =
    (u.inputTokens * role.inputPerMTok +
      u.outputTokens * role.outputPerMTok +
      u.cachedTokens * cachedRate) /
    1_000_000;
  return Math.round(usd * 100 * 10_000);
}

/** Invalidate after writing a role row, so a change is visible at once. */
export function clearModelRoleCache(): void {
  cache.clear();
}
