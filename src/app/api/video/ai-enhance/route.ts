import { NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import {
  fetchSourceBytes,
  createDerivedAsset,
  PARENT_FIELDS,
  type ParentAsset,
} from '@/modules/video/derive';
import { enhanceImage } from '@/modules/video/ai-image';

export const maxDuration = 300;

const schema = z
  .object({
    id: z.string().uuid(),
    /**
     * 'quality' cleans up what is there. 'detail' invents plausible
     * fine texture, which is what makes a tight crop usable.
     */
    mode: z.enum(['quality', 'detail']).default('quality'),
    size: z.enum(['1K', '2K', '4K']).default('4K'),
    /**
     * Optional crop, applied before the model sees the image. This is
     * the crop-and-zoom case: take a corner of a photograph and come
     * back with a full-size picture of just that.
     */
    crop: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0.02).max(1),
        h: z.number().min(0.02).max(1),
      })
      .optional(),
    note: z.string().trim().max(400).optional(),
  })
  .strict();

/**
 * Improve an image with AI, optionally on a crop of it.
 *
 * Separate from /enlarge, which is a plain lanczos resize: more
 * pixels and no new information. This one adds detail that was never
 * in the file, which is the only way a 1280px preview or a tight crop
 * of one can carry a full-width page.
 *
 * Result lands in the library as a new image beside the original, so
 * nothing is overwritten and a bad result is just deleted.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { id, mode, size, crop, note } = parsed.data;

  const supabase = createServiceClient();
  const { data: parent } = await supabase
    .from('video_assets')
    .select(PARENT_FIELDS)
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle<ParentAsset>();
  if (!parent) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!parent.mime_type.startsWith('image/')) {
    return NextResponse.json({ error: 'This works on images only.' }, { status: 400 });
  }

  try {
    const { bytes } = await fetchSourceBytes(orgId, parent);

    // Cropped here rather than by the model: a crop has one correct
    // answer and asking a generative model to "use the top left"
    // invites it to reinterpret the framing.
    let input = await sharp(bytes).rotate().jpeg({ quality: 95 }).toBuffer();
    if (crop) {
      const meta = await sharp(input).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (!w || !h) throw new Error('could not read the image dimensions');
      const left = Math.round(crop.x * w);
      const top = Math.round(crop.y * h);
      const cw = Math.max(1, Math.min(Math.round(crop.w * w), w - left));
      const ch = Math.max(1, Math.min(Math.round(crop.h * h), h - top));
      input = await sharp(input)
        .extract({ left, top, width: cw, height: ch })
        .jpeg({ quality: 95 })
        .toBuffer();
    }

    const out = await enhanceImage({
      orgId,
      source: { mimeType: 'image/jpeg', base64: input.toString('base64') },
      size,
      mode,
      note,
    });

    const full = await sharp(out.bytes).webp({ quality: 92 }).toBuffer();
    const meta = await sharp(full).metadata();

    const label = crop
      ? `${mode === 'detail' ? 'zoom' : 'enhanced crop'} ${size}`
      : `${mode === 'detail' ? 'detail' : 'enhanced'} ${size}`;
    const base = parent.file_name.replace(/\.[^.]+$/, '');

    const created = await createDerivedAsset({
      orgId,
      parent,
      fileName: `${base} (${label}).webp`,
      derivedKind: `ai_${mode}`,
      syntheticId: `ai:${parent.id}:${mode}:${size}:${
        crop
          ? `${crop.x.toFixed(4)},${crop.y.toFixed(4)},${crop.w.toFixed(4)},${crop.h.toFixed(4)}`
          : 'full'
      }`,
      full,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      pathSuffix: `(${label})`,
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      existed: created.existed,
      name: `${base} (${label}).webp`,
      width: meta.width,
      height: meta.height,
      model: out.model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
