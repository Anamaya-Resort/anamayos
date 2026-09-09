import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canUseVisuals } from '@/modules/video/auth';
import {
  listGalleries,
  createGallery,
  addToGallery,
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
