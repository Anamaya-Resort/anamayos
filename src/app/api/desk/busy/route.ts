import { NextResponse } from 'next/server';
import { z } from 'zod';
import { busySlots, requireDeskStaff } from '@/modules/desk/server';
import { serverError, validationError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  providerId: z.string().uuid().nullable(),
  personId: z.string().uuid().nullable(),
});

/** GET /api/desk/busy?date=&providerId=&personId= : booked spa time that day. */
export async function GET(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  const sp = new URL(request.url).searchParams;
  const parsed = schema.safeParse({ date: sp.get('date'), providerId: sp.get('providerId') || null, personId: sp.get('personId') || null });
  if (!parsed.success) return validationError(parsed.error.issues);
  try {
    const { date, providerId, personId } = parsed.data;
    return NextResponse.json(await busySlots(date, providerId, personId));
  } catch (e) {
    return serverError(e);
  }
}
