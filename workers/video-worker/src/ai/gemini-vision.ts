/**
 * Gemini vision tagging. Same controlled-vocabulary system prompt and
 * the same zod-validated VisionResult contract as the Claude path.
 *
 * Two things this used to get wrong, both of which made the Gemini
 * side look worse than it is:
 *
 * 1. It pasted a description of the JSON shape into the prompt and
 *    hoped. Gemini supports a real responseSchema; a malformed reply
 *    failed zod, errored the asset and burned a retry. Now the shape
 *    is enforced by the API, the same way the Claude path enforces it.
 *
 * 2. It resent the whole vocabulary-and-archetypes system prompt as
 *    fresh input tokens for every single image. Explicit caching
 *    charges a tenth of that. See cacheSystemPrompt() below for why
 *    it may still decline to cache.
 *
 * Raw REST, no SDK: keeps the worker dependency-free and matches how
 * it already talks to Drive.
 */
import { visionResultSchema, type VisionResult } from './vision.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const CACHE_TTL_SECONDS = 3600;

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY is required');
  return k;
}

/**
 * Gemini's responseSchema is an OpenAPI subset: uppercase type names,
 * no additionalProperties, and propertyOrdering to pin field order.
 */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    aesthetic_score: { type: 'NUMBER' },
    tags: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: {
            type: 'STRING',
            enum: ['subject', 'activity', 'mood', 'people', 'marketing_use'],
          },
          tag: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
          in_vocabulary: { type: 'BOOLEAN' },
        },
        required: ['category', 'tag', 'confidence', 'in_vocabulary'],
        propertyOrdering: ['category', 'tag', 'confidence', 'in_vocabulary'],
      },
    },
    detections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          kind: { type: 'STRING', enum: ['face', 'object'] },
          role: { type: 'STRING', enum: ['primary', 'secondary', 'none'] },
          bbox: { type: 'ARRAY', items: { type: 'NUMBER' } },
          confidence: { type: 'NUMBER' },
        },
        required: ['label', 'kind', 'role', 'bbox', 'confidence'],
        propertyOrdering: ['label', 'kind', 'role', 'bbox', 'confidence'],
      },
    },
    archetype_fit: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          archetype: { type: 'STRING' },
          score: { type: 'NUMBER' },
        },
        required: ['archetype', 'score'],
        propertyOrdering: ['archetype', 'score'],
      },
    },
  },
  required: ['summary', 'aesthetic_score', 'tags', 'detections', 'archetype_fit'],
  propertyOrdering: [
    'summary',
    'aesthetic_score',
    'tags',
    'detections',
    'archetype_fit',
  ],
} as const;

type CacheEntry = { name: string; expiresAt: number };
const promptCaches = new Map<string, CacheEntry | null>();

/**
 * Create (or reuse) an explicit context cache for a system prompt.
 *
 * Explicit caching has a per-model minimum token count, and our
 * vocabulary prompt sits near it: too short and the create call is
 * rejected. That is not an error worth failing an image over, so a
 * refusal is remembered as null and every later call for that prompt
 * goes inline. Gemini 2.5 also does implicit caching on repeated
 * prefixes at no cost, so the inline path is not as expensive as it
 * looks. Returns null when the prompt must be sent inline.
 */
async function cacheSystemPrompt(
  model: string,
  systemPrompt: string,
): Promise<string | null> {
  const id = `${model}:${systemPrompt.length}`;
  const hit = promptCaches.get(id);
  if (hit !== undefined) {
    if (hit === null) return null;
    if (hit.expiresAt > Date.now()) return hit.name;
  }

  try {
    const res = await fetch(`${API}/cachedContents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key() },
      body: JSON.stringify({
        model: `models/${model}`,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        ttl: `${CACHE_TTL_SECONDS}s`,
      }),
    });
    if (!res.ok) {
      promptCaches.set(id, null);
      return null;
    }
    const j = (await res.json()) as { name?: string };
    if (!j.name) {
      promptCaches.set(id, null);
      return null;
    }
    promptCaches.set(id, {
      name: j.name,
      // Re-create a minute early so a request never races the expiry.
      expiresAt: Date.now() + (CACHE_TTL_SECONDS - 60) * 1000,
    });
    return j.name;
  } catch {
    promptCaches.set(id, null);
    return null;
  }
}

export type GeminiUsage = {
  result: VisionResult;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export async function analyzeImageGemini(opts: {
  systemPrompt: string;
  imageBase64: string;
  model?: string;
  mimeType?: string;
}): Promise<GeminiUsage> {
  const model = opts.model ?? process.env.GEMINI_VISION_MODEL ?? 'gemini-2.5-flash';
  const cacheName = await cacheSystemPrompt(model, opts.systemPrompt);

  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: opts.mimeType ?? 'image/webp',
              data: opts.imageBase64,
            },
          },
          { text: 'Analyze and tag this image per the schema.' },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      // 2.5 Flash is a thinking model and thinking tokens are billed
      // against maxOutputTokens. Tagging against a fixed vocabulary
      // needs no reasoning; disabling it prevents truncated JSON and
      // mirrors the Claude path's thinking:disabled.
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 8192,
    },
  };
  if (cacheName) body.cachedContent = cacheName;
  else body.systemInstruction = { parts: [{ text: opts.systemPrompt }] };

  const res = await fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key() },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = (await res.text()).slice(-500);
    const err = new Error(`gemini ${res.status}: ${text}`);
    // Surfaced so the caller can back off rather than burn a retry.
    if (res.status === 429 || res.status >= 500) {
      (err as Error & { retryable?: boolean }).retryable = true;
    }
    throw err;
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      cachedContentTokenCount?: number;
    };
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('gemini: no text in response');

  const u = json.usageMetadata ?? {};
  const cached = u.cachedContentTokenCount ?? 0;
  return {
    result: visionResultSchema.parse(JSON.parse(text)),
    // promptTokenCount includes cached tokens; bill them separately.
    inputTokens: Math.max(0, (u.promptTokenCount ?? 0) - cached),
    outputTokens: u.candidatesTokenCount ?? 0,
    cachedTokens: cached,
  };
}
