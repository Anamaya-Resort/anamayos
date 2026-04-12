import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

/** POST /api/admin/tax-rates — create or update a tax rate (admin+) */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.slug || !body.name || body.rate === undefined) {
    return NextResponse.json({ error: 'Missing required fields: slug, name, rate' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const row = {
    slug: body.slug,
    name: body.name,
    rate: body.rate,
    is_compound: body.is_compound ?? false,
    applies_to: body.applies_to ?? [],
    is_active: body.is_active ?? true,
    sort_order: body.sort_order ?? 0,
  };

  const { data, error } = body.id
    ? await supabase.from('tax_rates').update(row).eq('id', body.id).select().single()
    : await supabase.from('tax_rates').insert(row).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, tax_rate: data });
}
