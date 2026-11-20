import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bookSpa, cancelCharge, chargeItem, DeskError, listCharges, requireDeskStaff } from '@/modules/desk/server';
import { serverError, validationError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const uuid = z.string().uuid();
const money = z.number().min(0).max(10000);

const createSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('spa'),
    bookingId: uuid,
    serviceId: uuid,
    providerId: uuid.nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    addonServiceIds: z.array(uuid).max(10),
    tip: money,
  }),
  z.object({
    kind: z.literal('item'),
    bookingId: uuid,
    productId: uuid,
    quantity: z.number().int().min(1).max(99),
    tip: money,
  }),
]);

const STATUS: Record<DeskError['code'], number> = {
  not_found: 404, provider_busy: 409, guest_busy: 409, outside_hours: 422, not_offered: 422, invalid: 422,
};

/** GET /api/desk/charges?bookingId= : the guest's folio charges. */
export async function GET(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  const id = uuid.safeParse(new URL(request.url).searchParams.get('bookingId'));
  if (!id.success) return validationError(id.error.issues);
  try {
    return NextResponse.json(await listCharges(id.data));
  } catch (e) {
    return serverError(e);
  }
}

/** POST /api/desk/charges : book a spa treatment or charge a shop item. */
export async function POST(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.issues);
  const bookedBy = auth.session.personId ?? null;
  try {
    const v = parsed.data;
    const id = v.kind === 'spa'
      ? await bookSpa({ ...v, bookedBy })
      : await chargeItem({ ...v, bookedBy });
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof DeskError) return NextResponse.json({ error: e.code }, { status: STATUS[e.code] });
    return serverError(e);
  }
}

/** DELETE /api/desk/charges?id= : cancel a charge (and its add-ons). */
export async function DELETE(request: Request) {
  const auth = await requireDeskStaff();
  if ('error' in auth) return auth.error;
  const id = uuid.safeParse(new URL(request.url).searchParams.get('id'));
  if (!id.success) return validationError(id.error.issues);
  try {
    await cancelCharge(id.data);
    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
