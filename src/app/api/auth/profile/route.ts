import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { updateProfileSchema } from '@/lib/api-schemas';
import { dbError, validationError } from '@/lib/api-utils';

/**
 * PUT /api/auth/profile — Update the current user's own profile
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.personId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  // Only allow updating safe fields — not email, access_level, roles, etc.
  const update: Record<string, unknown> = {
    full_name: v.full_name || null,
    phone: v.phone || null,
    gender: v.gender || null,
    date_of_birth: v.date_of_birth || null,
    country: v.country || null,
    city: v.city || null,
    nationality: v.nationality || null,
    pronouns: v.pronouns || null,
    address_line: v.address_line || null,
    whatsapp_number: v.whatsapp_number || null,
    instagram_handle: v.instagram_handle || null,
  };
  if (v.communication_preference !== undefined) update.communication_preference = v.communication_preference;

  const { error } = await supabase
    .from('persons')
    .update(update)
    .eq('id', session.personId);

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
