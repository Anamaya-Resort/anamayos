import { NextResponse } from 'next/server';
import { listDeskGuests, requireDeskStaff } from '@/modules/desk/server';
import { serverError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/** GET /api/desk/guests?q= : in-house guests, or a name/email search. */
export async function GET(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 80);
  try {
    return NextResponse.json(await listDeskGuests(q));
  } catch (e) {
    return serverError(e);
  }
}
