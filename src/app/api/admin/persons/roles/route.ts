import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { assignRoleSchema, removeRoleSchema } from '@/lib/api-schemas';
import { dbError, validationError } from '@/lib/api-utils';

/**
 * POST /api/admin/persons/roles — Assign a role to a person
 * DELETE /api/admin/persons/roles — Remove/expire a role
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = assignRoleSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  const { error } = await supabase.from('person_roles').upsert(
    {
      person_id: v.person_id,
      role_id: v.role_id,
      status: 'active',
      starts_at: new Date().toISOString().split('T')[0],
      employment_type: v.employment_type || null,
      notes: v.notes || null,
    },
    { onConflict: 'person_id,role_id' },
  );

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = removeRoleSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('person_roles')
    .update({ status: 'expired', ends_at: new Date().toISOString().split('T')[0] })
    .eq('id', parsed.data.person_role_id);

  if (error) return dbError(error);

  return NextResponse.json({ success: true });
}
