import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/persons — Create a new person
 * PUT /api/admin/persons — Update an existing person
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('persons')
    .insert({
      email: body.email?.toLowerCase().trim(),
      full_name: body.full_name || null,
      phone: body.phone || null,
      gender: body.gender || null,
      date_of_birth: body.date_of_birth || null,
      country: body.country || null,
      city: body.city || null,
      nationality: body.nationality || null,
      pronouns: body.pronouns || null,
      whatsapp_number: body.whatsapp_number || null,
      instagram_handle: body.instagram_handle || null,
      communication_preference: body.communication_preference || 'email',
      notes: body.notes || null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabase = createServiceClient();

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
      whatsapp_number: body.whatsapp_number || null,
      instagram_handle: body.instagram_handle || null,
      communication_preference: body.communication_preference || 'email',
      notes: body.notes || null,
      is_active: body.is_active ?? true,
    })
    .eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
