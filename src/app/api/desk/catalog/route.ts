import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDeskCatalog, requireDeskStaff } from '@/modules/desk/server';
import { DESK_CONFIG } from '@/modules/desk/config';
import { todayIn } from '@/modules/desk/time';
import { serverError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/** GET /api/desk/catalog?date=YYYY-MM-DD : spa + shop items priced for that day. */
export async function GET(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  const raw = new URL(request.url).searchParams.get('date');
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(raw).data ?? todayIn(DESK_CONFIG.timezone);
  try {
    return NextResponse.json(await getDeskCatalog(date));
  } catch (e) {
    return serverError(e);
  }
}
