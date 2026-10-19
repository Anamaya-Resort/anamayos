import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canUseVisuals } from '@/modules/video/auth';
import { tagFacets } from '@/modules/video/library/archive';

/**
 * The tag vocabulary, with counts, for browsing the collection.
 *
 * 1,445 distinct tags existed with no way to see any of them: the
 * only way in was guessing words into the search box.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canUseVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  try {
    return NextResponse.json({
      facets: await tagFacets({
        orgId,
        category: sp.get('category'),
        q: sp.get('q'),
        limit: Math.min(600, parseInt(sp.get('limit') ?? '400', 10) || 400),
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
