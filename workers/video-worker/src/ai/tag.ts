/**
 * One entry point for vision tagging, whichever provider the org's
 * `vision` role currently names. Callers pass an image and get back a
 * VisionResult plus what it cost - they never pick a model.
 *
 * Replaces ai/tag-frame.ts, which selected a provider by checking
 * whether GEMINI_API_KEY was set.
 */
import { analyzeImage, type VisionResult } from './vision.js';
import { analyzeImageGemini } from './gemini-vision.js';
import { getModelRole, microCents, type ModelRole } from './models.js';

export type TaggedImage = {
  result: VisionResult;
  providerId: string;
  modelEndpoint: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  microCents: number;
  latencyMs: number;
};

/** True for failures worth backing off on rather than failing the asset. */
export function isRetryable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: number; retryable?: boolean };
  if (e.retryable) return true;
  return e.status === 429 || (typeof e.status === 'number' && e.status >= 500);
}

export async function tagImageWith(
  role: ModelRole,
  opts: { systemPrompt: string; imageBase64: string; mimeType?: string },
): Promise<TaggedImage> {
  const started = Date.now();

  if (role.providerId === 'google') {
    const g = await analyzeImageGemini({
      systemPrompt: opts.systemPrompt,
      imageBase64: opts.imageBase64,
      model: role.modelEndpoint,
      mimeType: opts.mimeType,
    });
    const usage = {
      inputTokens: g.inputTokens,
      outputTokens: g.outputTokens,
      cachedTokens: g.cachedTokens,
    };
    return {
      result: g.result,
      providerId: role.providerId,
      modelEndpoint: role.modelEndpoint,
      ...usage,
      microCents: microCents(role, usage),
      latencyMs: Date.now() - started,
    };
  }

  if (role.providerId === 'anthropic') {
    const a = await analyzeImage({
      systemPrompt: opts.systemPrompt,
      imageBase64: opts.imageBase64,
      model: role.modelEndpoint,
      mediaType: opts.mimeType,
    });
    const usage = {
      inputTokens: a.cost.input,
      outputTokens: a.cost.output,
      cachedTokens: a.cacheRead,
    };
    return {
      result: a.result,
      providerId: role.providerId,
      modelEndpoint: role.modelEndpoint,
      ...usage,
      microCents: microCents(role, usage),
      latencyMs: Date.now() - started,
    };
  }

  throw new Error(
    `vision role points at provider '${role.providerId}', which has no image handler`,
  );
}

/** Tag using whatever model the org's `vision` role currently names. */
export async function tagImage(opts: {
  orgId: string;
  systemPrompt: string;
  imageBase64: string;
  mimeType?: string;
}): Promise<TaggedImage> {
  const role = await getModelRole(opts.orgId, 'vision');
  return tagImageWith(role, opts);
}
