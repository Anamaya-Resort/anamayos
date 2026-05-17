import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import {
  getReviewQueue,
  reviewCounts,
  type ReviewFilter,
} from '@/modules/video/review/queries';

const FILTERS: ReviewFilter[] = [
  'needs_review',
  'needs_consent',
  'approved',
  'rejected',
  'all',
];

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  const raw = sp.get('filter') ?? 'needs_review';
  const filter: ReviewFilter = FILTERS.includes(raw as ReviewFilter)
    ? (raw as ReviewFilter)
    : 'needs_review';
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0);

  const [counts, queue] = await Promise.all([
    reviewCounts(orgId),
    getReviewQueue(orgId, filter, offset),
  ]);

  return NextResponse.json({ counts, ...queue, filter });
}
