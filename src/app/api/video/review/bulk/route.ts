import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { bulkReviewSchema } from '@/modules/video/schemas';
import { bulkApply } from '@/modules/video/review/queries';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!session.personId) {
    return NextResponse.json({ error: 'no_person' }, { status: 400 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bulkReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { asset_ids, approval_status, use_permission } = parsed.data;
  try {
    const res = await bulkApply(orgId, asset_ids, session.personId, {
      approval_status,
      use_permission,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
