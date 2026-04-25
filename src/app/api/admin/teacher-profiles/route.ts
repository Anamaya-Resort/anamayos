import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/teacher-profiles?personId=uuid
 * Returns the teacher_profiles row for this person, or { profile: null }.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get('personId');
  if (!personId) return Response.json({ error: 'Missing personId' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('teacher_profiles')
    .select('*')
    .eq('person_id', personId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ profile: data });
}

/**
 * PUT /api/admin/teacher-profiles
 * Upserts a teacher profile. If a row exists for person_id, updates it; otherwise inserts.
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

  const personId = body.person_id as string;
  if (!personId) return Response.json({ error: 'Missing person_id' }, { status: 400 });

  // Non-admins can only edit their own teacher profile
  if (session.accessLevel < 5 && session.personId !== personId) {
    return Response.json({ error: 'You can only edit your own teacher profile' }, { status: 403 });
  }

  const fields = {
    short_bio: (body.short_bio as string) ?? '',
    public_bio: (body.public_bio as string) ?? '',
    teaching_style: (body.teaching_style as string) ?? '',
    years_experience: body.years_experience != null ? Number(body.years_experience) : null,
    certifications: body.certifications ?? [],
    specialties: body.specialties ?? [],
    languages: body.languages ?? ['en'],
    photo_url: (body.photo_url as string) || null,
    banner_image_url: (body.banner_image_url as string) || null,
    intro_video_url: (body.intro_video_url as string) || null,
    website_url: (body.website_url as string) || null,
    social_links: body.social_links ?? {},
    website_slug: (body.website_slug as string) || null,
    meta_description: (body.meta_description as string) || null,
    is_featured: body.is_featured === true,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const supabase = createServiceClient();

  // Check if profile exists
  const { data: existing } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('person_id', personId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('teacher_profiles')
      .update(fields)
      .eq('person_id', personId)
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ profile: data });
  }

  const { data, error } = await supabase
    .from('teacher_profiles')
    .insert({ person_id: personId, ...fields })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ profile: data });
}
