import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import {
  archiveAssets,
  restoreAssets,
  purgeArchived,
} from '@/modules/video/library/archive';

const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('archive'), assetIds: z.array(z.string().uuid()).min(1).max(2000) }).strict(),
  z.object({ op: z.literal('restore'), assetIds: z.array(z.string().uuid()).min(1).max(2000) }).strict(),
  // Permanent. Separate verb, and it only ever touches rows that are
  // already archived, so it cannot be reached straight from the grid.
  z.object({ op: z.literal('purge'), assetIds: z.array(z.string().uuid()).min(1).max(2000) }).strict(),
]);

/**
 * Archive, restore, or permanently remove images.
 *
 * Nothing could leave the collection before this. Archiving rather
 * than deleting because a published gallery may still reference the
 * row and the website reads those live.
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

  try {
    const { op, assetIds } = parsed.data;
    if (op === 'archive') {
      return NextResponse.json({
        ok: true,
        ...(await archiveAssets({ orgId, assetIds, by: session.personId ?? null })),
      });
    }
    if (op === 'restore') {
      return NextResponse.json({ ok: true, ...(await restoreAssets({ orgId, assetIds })) });
    }
    return NextResponse.json({ ok: true, ...(await purgeArchived({ orgId, assetIds })) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
