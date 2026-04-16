import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { createPersonSchema, updatePersonSchema } from '@/lib/api-schemas';
import { dbError, validationError } from '@/lib/api-utils';

/**
 * POST /api/admin/persons — Create a new person
 * PUT /api/admin/persons — Update an existing person
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createPersonSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('persons')
    .insert({
      email: v.email.toLowerCase().trim(),
      full_name: v.full_name || null,
      phone: v.phone || null,
      gender: v.gender || null,
      date_of_birth: v.date_of_birth || null,
      country: v.country || null,
      city: v.city || null,
      nationality: v.nationality || null,
      pronouns: v.pronouns || null,
      whatsapp_number: v.whatsapp_number || null,
      instagram_handle: v.instagram_handle || null,
      communication_preference: v.communication_preference,
      notes: v.notes || null,
    })
    .select('id')
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ success: true, id: data.id });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updatePersonSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {
    full_name: v.full_name || null,
    phone: v.phone || null,
    gender: v.gender || null,
    date_of_birth: v.date_of_birth || null,
    country: v.country || null,
    city: v.city || null,
    nationality: v.nationality || null,
    pronouns: v.pronouns || null,
    whatsapp_number: v.whatsapp_number || null,
    instagram_handle: v.instagram_handle || null,
    notes: v.notes || null,
  };
  if (v.communication_preference !== undefined) update.communication_preference = v.communication_preference;
  if (v.is_active !== undefined) update.is_active = v.is_active;

  const { error } = await supabase
    .from('persons')
    .update(update)
    .eq('id', v.id);

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
