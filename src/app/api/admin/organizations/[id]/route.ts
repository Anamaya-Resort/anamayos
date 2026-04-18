import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * GET /api/admin/organizations/[id]
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('*, org_members(id, person_id, role, person:persons(id, full_name, email, avatar_url)), owner:persons!organizations_owner_id_fkey(id, full_name, email)')
    .eq('id', id)
    .single();

  if (!org) return Response.json({ error: 'Not found' }, { status: 404 });

  // Non-superadmins can only see orgs they belong to
  if (session.accessLevel < 7) {
    const isMember = (org.org_members as Array<{ person_id: string }>).some(
      (m) => m.person_id === session.personId
    );
    if (!isMember) return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  return Response.json({ organization: org });
}

/**
 * PUT /api/admin/organizations/[id]
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: org, error } = await supabase
    .from('organizations')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ organization: org });
}
