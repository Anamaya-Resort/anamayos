/**
 * Vision-tagging provider selector for VIDEO frames.
 *
 * Gemini 2.5 Flash when GEMINI_API_KEY is set (cheapest), else
 * Claude Haiku 4.5. The curated-image path (jobs/analyze.ts) is
 * deliberately NOT routed through here — it stays on Claude Sonnet.
 * Returns a unified result + the cost in cents + the model used.
 */
import { analyzeImage, type VisionResult } from './vision.js';
import { analyzeImageGemini } from './gemini-vision.js';

// Approximate per-1M-token USD; tune via env without a redeploy.
const GEMINI_IN = Number(process.env.GEMINI_INPUT_PER_M ?? 0.3);
const GEMINI_OUT = Number(process.env.GEMINI_OUTPUT_PER_M ?? 2.5);

export type TaggedFrame = {
  result: VisionResult;
  costCents: number;
  model: string;
};

export async function tagFrame(opts: {
  systemPrompt: string;
  imageBase64: string;
}): Promise<TaggedFrame> {
  if (process.env.GEMINI_API_KEY) {
    const { result, inputTokens, outputTokens } =
      await analyzeImageGemini(opts);
    const costCents = Math.ceil(
      ((inputTokens * GEMINI_IN + outputTokens * GEMINI_OUT) / 1_000_000) * 100,
    );
    return { result, costCents, model: 'gemini-2.5-flash' };
  }

  // Claude Haiku 4.5: $1/1M in, $5/1M out, cache reads ~0.1x in.
  const ai = await analyzeImage({
    systemPrompt: opts.systemPrompt,
    imageBase64: opts.imageBase64,
    model: 'claude-haiku-4-5',
  });
  const costCents = Math.ceil(
    ((ai.cost.input * 1 + ai.cost.output * 5 + ai.cacheRead * 0.1) /
      1_000_000) *
      100,
  );
  return { result: ai.result, costCents, model: 'claude-haiku-4-5' };
}
