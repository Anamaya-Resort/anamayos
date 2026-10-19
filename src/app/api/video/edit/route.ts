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

export const maxDuration = 120;

const schema = z
  .object({
    id: z.string().uuid(),
    /** Quarter turns clockwise. */
    rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
    /** Fine levelling, degrees. Positive tilts clockwise. */
    straighten: z.number().min(-20).max(20).default(0),
    /**
     * Crop as fractions of the straightened image, so the numbers
     * stay meaningful whatever the source resolution turns out to be.
     */
    crop: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0.02).max(1),
        h: z.number().min(0.02).max(1),
      })
      .optional(),
    flip: z.enum(['none', 'horizontal', 'vertical']).default('none'),
  })
  .strict();

/**
 * Crop, rotate, straighten and flip.
 *
 * Writes a new image rather than changing the one you started from:
 * this system holds only a 1280px preview of anything scanned, so an
 * in-place edit would destroy the only copy it has.
 *
 * Order matters and is fixed: quarter turns, then fine levelling,
 * then the crop. Levelling has to come before the crop or the corners
 * the rotation introduces end up inside the frame, and a crop chosen
 * on screen is always chosen against an already-levelled picture.
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
  const { id, rotate, straighten, crop, flip } = parsed.data;

  if (rotate === 0 && straighten === 0 && !crop && flip === 'none') {
    return NextResponse.json({ error: 'nothing to do' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: parent } = await supabase
    .from('video_assets')
    .select(PARENT_FIELDS)
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle<ParentAsset>();
  if (!parent) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!parent.mime_type.startsWith('image/')) {
    return NextResponse.json({ error: 'Editing is for images only.' }, { status: 400 });
  }

  try {
    const { bytes } = await fetchSourceBytes(orgId, parent);

    // .rotate() with no argument first, to honour any EXIF
    // orientation before geometry is applied by hand. Without it a
    // phone photo is edited in the orientation it was stored in, not
    // the one it is displayed in, and every crop lands wrong.
    let img = sharp(bytes).rotate();
    if (rotate !== 0) img = img.rotate(rotate);
    if (flip === 'horizontal') img = img.flop();
    if (flip === 'vertical') img = img.flip();

    if (straighten !== 0) {
      // A levelling turn exposes the background at the corners. Those
      // wedges are meant to be cropped away, so they are filled with
      // transparency rather than a colour that would look deliberate
      // if the crop does not quite cover them.
      img = img.rotate(straighten, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    // Flattened to pixels before cropping: after a rotation the
    // dimensions the crop has to be measured against are the rotated
    // ones, which sharp only knows once the operation has been run.
    let working = await img.webp({ quality: 95 }).toBuffer();
    let meta = await sharp(working).metadata();

    if (crop) {
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (!w || !h) throw new Error('could not read the image dimensions');
      const left = Math.round(crop.x * w);
      const top = Math.round(crop.y * h);
      // Clamped so a crop dragged to the very edge cannot ask for a
      // pixel past the end of the row, which sharp rejects outright.
      const cw = Math.max(1, Math.min(Math.round(crop.w * w), w - left));
      const ch = Math.max(1, Math.min(Math.round(crop.h * h), h - top));
      working = await sharp(working)
        .extract({ left, top, width: cw, height: ch })
        .webp({ quality: 95 })
        .toBuffer();
      meta = await sharp(working).metadata();
    }

    const outW = meta.width ?? 0;
    const outH = meta.height ?? 0;

    // The name says what was done, so a shelf of edits stays legible.
    const parts: string[] = [];
    if (crop) parts.push('cropped');
    if (rotate !== 0) parts.push(`rotated ${rotate}`);
    if (straighten !== 0) parts.push(`levelled ${straighten > 0 ? '+' : ''}${straighten}`);
    if (flip !== 'none') parts.push(flip === 'horizontal' ? 'flipped' : 'flipped v');
    const label = parts.join(', ');

    const base = parent.file_name.replace(/\.[^.]+$/, '');
    const created = await createDerivedAsset({
      orgId,
      parent,
      fileName: `${base} (${label}).webp`,
      derivedKind: 'edit',
      // The geometry is part of the identity, so two different crops
      // of one photo are two assets but the same crop twice is one.
      syntheticId: `edit:${parent.id}:${rotate}:${straighten}:${flip}:${
        crop ? `${crop.x.toFixed(4)},${crop.y.toFixed(4)},${crop.w.toFixed(4)},${crop.h.toFixed(4)}` : 'full'
      }`,
      full: working,
      width: outW,
      height: outH,
      pathSuffix: `(${label})`,
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      existed: created.existed,
      name: `${base} (${label}).webp`,
      width: outW,
      height: outH,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
