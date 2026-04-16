import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { taxRateSchema } from '@/lib/api-schemas';
import { dbError, validationError } from '@/lib/api-utils';

/** GET /api/admin/tax-rates — list active tax rates */
export async function GET() {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 3) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('tax_rates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) return dbError(error);

  return NextResponse.json(data);
}

/** POST /api/admin/tax-rates — create or update a tax rate (admin+) */
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

  const parsed = taxRateSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const v = parsed.data;
  const supabase = createServiceClient();

  const row = {
    slug: v.slug,
    name: v.name,
    rate: v.rate,
    is_compound: v.is_compound,
    applies_to: v.applies_to,
    is_active: v.is_active,
    sort_order: v.sort_order,
  };

  const { data, error } = v.id
    ? await supabase.from('tax_rates').update(row).eq('id', v.id).select().single()
    : await supabase.from('tax_rates').insert(row).select().single();

  if (error) return dbError(error);

  return NextResponse.json({ success: true, tax_rate: data });
}
