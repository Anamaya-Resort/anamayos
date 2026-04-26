import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/retreats — Create a new retreat
 * Auto-adds the creator as primary teacher in retreat_teachers.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name as string)?.trim();
  if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: retreat, error } = await supabase
    .from('retreats')
    .insert({
      name,
      tagline: body.tagline ?? null,
      retreat_type: body.retreat_type ?? 'yoga',
      retreat_type_custom: body.retreat_type_custom ?? null,
      skill_level: body.skill_level ?? 'all_levels',
      date_type: body.date_type ?? 'fixed',
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      package_nights: body.package_nights ?? null,
      check_in_time: body.check_in_time ?? '15:00',
      check_out_time: body.check_out_time ?? '11:00',
      max_capacity: body.max_capacity ?? null,
      min_capacity: body.min_capacity ?? null,
      minimum_age: body.minimum_age ?? null,
      primary_language: body.primary_language ?? 'en',
      secondary_language: body.secondary_language ?? null,
      registration_deadline: body.registration_deadline ?? null,
      status: 'draft',
      is_public: false,
      leader_person_id: session.personId,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Auto-add creator as primary teacher
  await supabase.from('retreat_teachers').insert({
    retreat_id: retreat.id,
    person_id: session.personId,
    role: 'lead',
    is_primary: true,
  });

  return Response.json({ retreat }, { status: 201 });
}

/**
 * PUT /api/admin/retreats — Update retreat fields
 * Body must include `id`. Only fields present in the body are updated.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = body.id as string;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServiceClient();

  // Retreat leaders can only edit their own retreats
  if (session.accessLevel < 5) {
    const { data: teacher } = await supabase
      .from('retreat_teachers')
      .select('id')
      .eq('retreat_id', id)
      .eq('person_id', session.personId)
      .maybeSingle();
    if (!teacher) return Response.json({ error: 'Not authorized for this retreat' }, { status: 403 });
  }

  // Build update object — only include fields that are present
  const allowedFields = [
    'name', 'tagline', 'retreat_type', 'retreat_type_custom', 'skill_level',
    'date_type', 'start_date', 'end_date', 'package_nights',
    'check_in_time', 'check_out_time', 'max_capacity', 'min_capacity',
    'minimum_age', 'maximum_age', 'primary_language', 'secondary_language',
    'registration_deadline', 'excerpt', 'description', 'what_to_expect',
    'highlights', 'what_is_included', 'what_is_not_included',
    'prerequisites', 'what_to_bring', 'welcome_message', 'cancellation_policy',
    'faqs', 'itinerary', 'pricing_model', 'deposit_percentage',
    'is_private_retreat', 'curve_start_price', 'curve_end_price',
    'addons_enabled', 'registration_status', 'waitlist_enabled',
    'requires_application', 'certificate_offered', 'ryt_hours',
    'location_name', 'nearest_airport', 'notes', 'video_url',
  ];

  // Admin-only fields
  const adminFields = [
    'status', 'is_public', 'is_featured', 'is_sold_out',
    'website_slug', 'meta_title', 'meta_description', 'structured_data',
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key];
  }
  if (session.accessLevel >= 5) {
    for (const key of adminFields) {
      if (key in body) update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('retreats')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ retreat: data });
}
