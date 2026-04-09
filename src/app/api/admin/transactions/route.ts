import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/transactions — Fetch transactions with person names
 */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('id, submitted_at, class, category, description, charge_amount, credit_amount, grand_total, currency, persons(full_name)')
    .order('submitted_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transactions = (data ?? []).map((t: Record<string, unknown>) => ({
    ...(t as Record<string, unknown>),
    person_name: (t.persons as Record<string, unknown>)?.full_name ?? null,
  }));

  return NextResponse.json({ transactions });
}
