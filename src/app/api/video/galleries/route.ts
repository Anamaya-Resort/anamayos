import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canUseVisuals } from '@/modules/video/auth';
import {
  listGalleries,
  createGallery,
  addToGallery,
  removeFromGallery,
  setGalleryPublished,
  updateGallery,
  reorderGallery,
  setGalleryItemCaption,
  deleteGallery,
} from '@/modules/video/galleries/queries';

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    assetIds: z.array(z.string().uuid()).max(2000).optional(),
  })
  .strict();

const addSchema = z
  .object({
    galleryId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1).max(2000),
  })
  .strict();

const removeSchema = z
  .object({
    galleryId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1).max(2000),
  })
  .strict();

/** No assetIds = delete the gallery itself, not its contents. */
const dropGallerySchema = z
  .object({ galleryId: z.string().uuid(), deleteGallery: z.literal(true) })
  .strict();

/**
 * Everything that edits a gallery without changing what is in it.
 * One shape per operation, discriminated on `op`, because "set the
 * cover" and "reorder" have nothing in common beyond the gallery id
 * and collapsing them into one loose object makes it possible to
 * send a reorder with no order.
 */
const patchSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('publish'),
    galleryId: z.string().uuid(),
    isPublished: z.boolean(),
  }).strict(),
  z.object({
    op: z.literal('details'),
    galleryId: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    coverAssetId: z.string().uuid().nullable().optional(),
  }).strict(),
  z.object({
    op: z.literal('reorder'),
    galleryId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1).max(2000),
  }).strict(),
  z.object({
    op: z.literal('caption'),
    galleryId: z.string().uuid(),
    assetId: z.string().uuid(),
    caption: z.string().trim().max(500).nullable(),
  }).strict(),
]);

/** Legacy shape: a bare publish with no `op`. Kept so an older tab
 *  open in a browser does not start failing mid-session. */
const legacyPublishSchema = z
  .object({ galleryId: z.string().uuid(), isPublished: z.boolean() })
  .strict();

/**
 * Edit a gallery: publish it, rename it, set its cover, reorder it,
 * or caption one of its images. Nothing here adds or removes
 * images - that is POST and DELETE.
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canUseVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const raw = await req.json().catch(() => null);
  type Op = z.infer<typeof patchSchema>;

  // Built field by field rather than spread, so the discriminated
  // union still narrows in the switch below.
  let op: Op | null = null;
  const parsed = patchSchema.safeParse(raw);
  if (parsed.success) {
    op = parsed.data;
  } else {
    const legacy = legacyPublishSchema.safeParse(raw);
    if (legacy.success) {
      op = {
        op: 'publish',
        galleryId: legacy.data.galleryId,
        isPublished: legacy.data.isPublished,
      };
    }
  }
  if (!op) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  try {
    switch (op.op) {
      case 'publish':
        await setGalleryPublished({
          orgId,
          galleryId: op.galleryId,
          isPublished: op.isPublished,
        });
        break;
      case 'details':
        await updateGallery({
          orgId,
          galleryId: op.galleryId,
          name: op.name,
          description: op.description,
          coverAssetId: op.coverAssetId,
        });
        break;
      case 'reorder':
        await reorderGallery({
          orgId,
          galleryId: op.galleryId,
          assetIds: op.assetIds,
        });
        break;
      case 'caption':
        await setGalleryItemCaption({
          orgId,
          galleryId: op.galleryId,
          assetId: op.assetId,
          caption: op.caption,
        });
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Take images out of a gallery. Membership only - the images stay in
 * the library, which is the whole point of a gallery being a reference
 * rather than a container.
 */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canUseVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const raw = await req.json().catch(() => null);

  // Dropping the whole gallery is a different act from taking images
  // out of it, and needs an explicit flag so it can never be the
  // accidental result of an empty selection.
  const drop = dropGallerySchema.safeParse(raw);
  if (drop.success) {
    try {
      await deleteGallery({ orgId, galleryId: drop.data.galleryId });
      return NextResponse.json({ ok: true, deleted: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const parsed = removeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  try {
    const r = await removeFromGallery({
      orgId,
      galleryId: parsed.data.galleryId,
      assetIds: parsed.data.assetIds,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canUseVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });
  return NextResponse.json({ galleries: await listGalleries(orgId) });
}

/** Create a gallery, or add to one. `galleryId` present = add. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canUseVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const who = session.personId ?? null;

  if (body && typeof body === 'object' && 'galleryId' in body) {
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    try {
      const r = await addToGallery({
        orgId,
        galleryId: parsed.data.galleryId,
        assetIds: parsed.data.assetIds,
        addedBy: who,
      });
      return NextResponse.json({ ok: true, ...r });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  try {
    const created = await createGallery({
      orgId,
      name: parsed.data.name,
      createdBy: who,
      assetIds: parsed.data.assetIds,
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
