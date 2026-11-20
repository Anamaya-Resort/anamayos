import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addShift, deleteShift, getSpaDay, requireDeskStaff, setDayNote, updateShift } from '@/modules/desk/server';
import { serverError, validationError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const uuid = z.string().uuid();

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('note'), date, note: z.string().max(500) }),
  z.object({ action: z.literal('addShift'), date, personId: uuid, start: time, end: time }),
  z.object({ action: z.literal('updateShift'), id: uuid, start: time, end: time }),
  z.object({ action: z.literal('deleteShift'), id: uuid }),
]);

/** GET /api/desk/day?date= : the spa day sheet (sessions, hours, note). */
export async function GET(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  const d = date.safeParse(new URL(request.url).searchParams.get('date'));
  if (!d.success) return validationError(d.error.issues);
  try {
    return NextResponse.json(await getSpaDay(d.data));
  } catch (e) {
    return serverError(e);
  }
}

/** POST /api/desk/day : edit the day note or a therapist's hours. */
export async function POST(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.issues);
  const v = parsed.data;
  if ((v.action === 'addShift' || v.action === 'updateShift') && v.end <= v.start) {
    return NextResponse.json({ error: 'invalid' }, { status: 422 });
  }
  try {
    switch (v.action) {
      case 'note': await setDayNote(v.date, v.note, auth.session.personId ?? null); break;
      case 'addShift': return NextResponse.json({ id: await addShift(v.personId, v.date, v.start, v.end) });
      case 'updateShift': await updateShift(v.id, v.start, v.end); break;
      case 'deleteShift': await deleteShift(v.id); break;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
