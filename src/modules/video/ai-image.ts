/**
 * AI image work: generating a new photograph, and adding real detail
 * to one we already have.
 *
 * Model choice. As of 2026-Oct the best available for both jobs is
 * Google's Nano Banana Pro (`gemini-3-pro-image`), picked for the one
 * capability this use needs most: it accepts up to 14 reference
 * images and holds their lighting, palette and setting across a new
 * generation. That is exactly "use these photos of Anamaya as the
 * look", and it is what the competing models document least well -
 * FLUX.2 takes 4 to 8 references depending on tier, and GPT Image 2's
 * reference behaviour is barely specified. It also outputs 4K, which
 * matters here because the library itself only holds 1280px previews.
 *
 * Which model is used is not hard-coded: it comes from
 * video_maker_model_roles, the same table the tagging models come
 * from, so swapping provider or model is a database change rather
 * than a deploy. The call shape below is Gemini's; a different
 * provider needs a sibling of callGemini().
 */
import { createServiceClient } from '@/lib/supabase/server';

/** Falls back to Nano Banana Pro when the role row is missing. */
const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Nano Banana Pro's documented ceiling for mixed reference images. */
export const MAX_REFERENCES = 14;

export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export type RefImage = { mimeType: string; base64: string };

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) {
    throw new Error(
      'GEMINI_API_KEY is not set, so AI image generation is unavailable.',
    );
  }
  return k;
}

/** The model configured for a role, or the default. */
export async function modelForRole(
  orgId: string,
  role: 'image_generate' | 'image_enhance',
): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('video_maker_model_roles')
    .select('model_endpoint')
    .eq('org_id', orgId)
    .eq('role', role)
    .maybeSingle();
  return (data as { model_endpoint: string } | null)?.model_endpoint ?? DEFAULT_IMAGE_MODEL;
}

/**
 * One image back from Gemini, or a clear reason why not.
 *
 * The model can answer with text instead of a picture when it
 * declines a prompt, so a missing image part is reported with
 * whatever it said rather than as an empty failure - otherwise a
 * refusal looks identical to a network fault.
 */
async function callGemini(opts: {
  model: string;
  prompt: string;
  refs: RefImage[];
  size: ImageSize;
  aspect?: AspectRatio;
}): Promise<{ bytes: Buffer; mimeType: string }> {
  const parts: unknown[] = [{ text: opts.prompt }];
  for (const r of opts.refs.slice(0, MAX_REFERENCES)) {
    parts.push({ inline_data: { mime_type: r.mimeType, data: r.base64 } });
  }

  const imageConfig: Record<string, string> = { imageSize: opts.size };
  // Aspect ratio is left unset when editing, so the model keeps the
  // source's shape instead of quietly reframing it.
  if (opts.aspect) imageConfig.aspectRatio = opts.aspect;

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(opts.model)}:generateContent?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig },
      }),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    // 403 here is nearly always the project lacking image-generation
    // access rather than a bad key, and the raw message does not say
    // so. Worth naming, because the key works fine for tagging.
    if (res.status === 403) {
      throw new Error(
        'Google refused image generation for this API key\'s project (403). ' +
          'Image generation has to be enabled on the project, separately from ' +
          'the vision access already in use for tagging.',
      );
    }
    throw new Error(`image model failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = JSON.parse(text) as {
    candidates?: {
      content?: { parts?: { text?: string; inlineData?: { data: string; mimeType: string } }[] };
      finishReason?: string;
    }[];
  };
  const resultParts = json.candidates?.[0]?.content?.parts ?? [];
  const image = resultParts.find((p) => p.inlineData)?.inlineData;
  if (!image) {
    const said = resultParts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 300);
    throw new Error(
      said
        ? `The model returned words instead of a picture: ${said}`
        : `The model returned no image (${json.candidates?.[0]?.finishReason ?? 'no reason given'}).`,
    );
  }
  return {
    bytes: Buffer.from(image.data, 'base64'),
    mimeType: image.mimeType ?? 'image/png',
  };
}

/**
 * A new photograph, optionally in the style of images you select.
 *
 * The references do the work that a long prose description of
 * lighting never manages: hand it six of Anamaya's own photographs
 * and the output carries that light and palette instead of generic
 * stock warmth.
 */
export async function generateImage(opts: {
  orgId: string;
  prompt: string;
  references: RefImage[];
  aspect: AspectRatio;
  size: ImageSize;
}): Promise<{ bytes: Buffer; mimeType: string; model: string }> {
  const model = await modelForRole(opts.orgId, 'image_generate');

  const prompt = opts.references.length
    ? `${opts.prompt}\n\nUse the attached photographs as the reference for ` +
      'lighting, colour palette, time of day, materials and overall mood. ' +
      'Match that look closely. Do not copy their subjects or composition, ' +
      'and do not reproduce any recognisable person from them. ' +
      'The result must look like a real photograph taken at the same place.'
    : `${opts.prompt}\n\nThe result must look like a real photograph, not an illustration or a render.`;

  const out = await callGemini({
    model,
    prompt,
    refs: opts.references,
    size: opts.size,
    aspect: opts.aspect,
  });
  return { ...out, model };
}

/**
 * Add real detail to an existing image.
 *
 * Different from the existing Enlarge, deliberately. Enlarge is a
 * lanczos resize: more pixels, no new information, which is what was
 * asked for when a faithful blow-up was the point. This invents
 * plausible detail that was never in the file, which is what you want
 * when a 1280px preview has to fill a hero, and is the only way a
 * tight crop of one can carry a page.
 */
export async function enhanceImage(opts: {
  orgId: string;
  source: RefImage;
  size: ImageSize;
  mode: 'quality' | 'detail';
  note?: string;
}): Promise<{ bytes: Buffer; mimeType: string; model: string }> {
  const model = await modelForRole(opts.orgId, 'image_enhance');

  const base =
    opts.mode === 'quality'
      ? 'Restore and improve this photograph. Remove compression artefacts, ' +
        'recover natural sharpness and fine texture, correct noise and banding, ' +
        'and even out the exposure where it is blown out or blocked up.'
      : 'Increase the real detail in this photograph as if it had been shot on ' +
        'a much higher-resolution camera. Resolve fine texture in foliage, fabric, ' +
        'wood grain, skin and water.';

  const prompt =
    `${base}\n\nKeep the composition, framing, crop, colours and every subject ` +
    'exactly as they are. Do not add, remove, move or restyle anything, and do not ' +
    'change anyone\'s face or body. This is a real photograph of a real place and it ' +
    'must stay truthful to it.' +
    (opts.note ? `\n\nAlso: ${opts.note}` : '');

  const out = await callGemini({
    model,
    prompt,
    refs: [opts.source],
    size: opts.size,
  });
  return { ...out, model };
}
