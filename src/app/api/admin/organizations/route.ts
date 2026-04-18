import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});

/**
 * GET /api/admin/organizations
 * Superadmins see all orgs, admins see orgs they belong to.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();

  let orgs;
  if (session.accessLevel >= 7) {
    // Superadmin: see all
    const { data } = await supabase
      .from('organizations')
      .select('*, org_members(person_id, role), owner:persons!organizations_owner_id_fkey(id, full_name, email)')
      .eq('is_active', true)
      .order('name');
    orgs = data;
  } else {
    // Admin: see orgs they belong to
    const { data: memberships } = await supabase
      .from('org_members').select('org_id').eq('person_id', session.personId);
    const orgIds = (memberships ?? []).map((m: { org_id: string }) => m.org_id);
    if (orgIds.length === 0) return Response.json({ organizations: [] });

    const { data } = await supabase
      .from('organizations')
      .select('*, org_members(person_id, role), owner:persons!organizations_owner_id_fkey(id, full_name, email)')
      .in('id', orgIds)
      .eq('is_active', true)
      .order('name');
    orgs = data;
  }

  return Response.json({ organizations: orgs ?? [] });
}

/**
 * POST /api/admin/organizations
 * Create a new organization. Creator becomes owner.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { name, slug, description } = parsed.data;

  // Create org
  const { data: org, error } = await supabase
    .from('organizations')
    .insert({ name, slug, description: description ?? null, owner_id: session.personId })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return Response.json({ error: 'An organization with that slug already exists' }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Add creator as owner member
  await supabase.from('org_members').insert({
    org_id: org.id,
    person_id: session.personId,
    role: 'owner',
  });

  return Response.json({ organization: org }, { status: 201 });
}
