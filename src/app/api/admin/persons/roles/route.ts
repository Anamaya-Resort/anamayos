import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/persons/roles — Assign a role to a person
 * DELETE /api/admin/persons/roles — Remove/expire a role
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { person_id, role_id, employment_type, notes } = await request.json();
  if (!person_id || !role_id) {
    return NextResponse.json({ error: 'Missing person_id or role_id' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase.from('person_roles').upsert(
    {
      person_id,
      role_id,
      status: 'active',
      starts_at: new Date().toISOString().split('T')[0],
      employment_type: employment_type || null,
      notes: notes || null,
    },
    { onConflict: 'person_id,role_id' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { person_role_id } = await request.json();
  if (!person_role_id) {
    return NextResponse.json({ error: 'Missing person_role_id' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('person_roles')
    .update({ status: 'expired', ends_at: new Date().toISOString().split('T')[0] })
    .eq('id', person_role_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
