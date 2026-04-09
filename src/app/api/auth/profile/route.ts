import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * PUT /api/auth/profile — Update the current user's own profile
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.personId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createServiceClient();

  // Only allow updating safe fields — not email, access_level, roles, etc.
  const { error } = await supabase
    .from('persons')
    .update({
      full_name: body.full_name || null,
      phone: body.phone || null,
      gender: body.gender || null,
      date_of_birth: body.date_of_birth || null,
      country: body.country || null,
      city: body.city || null,
      nationality: body.nationality || null,
      pronouns: body.pronouns || null,
      address_line: body.address_line || null,
      whatsapp_number: body.whatsapp_number || null,
      instagram_handle: body.instagram_handle || null,
      communication_preference: body.communication_preference || 'email',
    })
    .eq('id', session.personId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
