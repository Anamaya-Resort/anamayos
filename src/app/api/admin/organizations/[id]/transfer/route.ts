import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const transferSchema = z.object({ newOwnerId: z.string().uuid() });

/**
 * POST /api/admin/organizations/[id]/transfer
 * Transfer ownership to another admin.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify current user is owner or superadmin
  const { data: org } = await supabase.from('organizations').select('owner_id').eq('id', id).single();
  if (!org) return Response.json({ error: 'Not found' }, { status: 404 });
  if (session.accessLevel < 7 && org.owner_id !== session.personId) {
    return Response.json({ error: 'Only the owner or a superadmin can transfer ownership' }, { status: 403 });
  }

  const { newOwnerId } = parsed.data;

  // Verify new owner exists and has admin+ access
  const { data: newOwner } = await supabase.from('persons').select('id, access_level').eq('id', newOwnerId).single();
  if (!newOwner || (newOwner.access_level ?? 1) < 5) {
    return Response.json({ error: 'New owner must be an admin or higher' }, { status: 400 });
  }

  // Transfer
  await supabase.from('organizations').update({ owner_id: newOwnerId }).eq('id', id);

  // Update member roles
  await supabase.from('org_members').update({ role: 'admin' }).eq('org_id', id).eq('person_id', org.owner_id);
  await supabase.from('org_members').upsert(
    { org_id: id, person_id: newOwnerId, role: 'owner' },
    { onConflict: 'org_id,person_id' },
  );

  return Response.json({ ok: true });
}
