/**
 * Gemini 2.5 Flash vision tagging — a cheaper drop-in alternative
 * to the Claude path (ai/vision.ts) for video frames. Same
 * controlled-vocabulary system prompt, same VisionResult contract
 * (zod-validated before it's trusted into the DB).
 *
 * Raw REST (no SDK) — keeps the worker dependency-free and avoids
 * CJS/ESM interop; the worker already uses fetch for Drive.
 */
import { visionResultSchema, type VisionResult } from './vision.js';

const MODEL = process.env.GEMINI_VISION_MODEL ?? 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Gemini isn't given the Claude json_schema; spell the shape out so
// the JSON it returns matches what visionResultSchema expects.
const SHAPE = `Return ONLY a JSON object with exactly these keys:
{
  "summary": string (one concise sentence),
  "aesthetic_score": number (1..10),
  "tags": [ { "category": "subject"|"activity"|"mood"|"people"|"marketing_use", "tag": string, "confidence": number, "in_vocabulary": boolean } ],
  "detections": [ { "label": string, "kind": "face"|"object", "role": "primary"|"secondary"|"none", "bbox": [x,y,w,h] (normalized 0..1, origin top-left), "confidence": number } ],
  "archetype_fit": [ { "archetype": string, "score": number (0..1) } ]
}`;

export async function analyzeImageGemini(opts: {
  systemPrompt: string;
  imageBase64: string;
}): Promise<{ result: VisionResult; inputTokens: number; outputTokens: number }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is required');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: { mimeType: 'image/webp', data: opts.imageBase64 },
            },
            { text: `Analyze and tag this image per the schema.\n\n${SHAPE}` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 3000,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`gemini ${res.status}: ${(await res.text()).slice(-500)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('gemini: no text in response');

  const result = visionResultSchema.parse(JSON.parse(text));
  return {
    result,
    inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
