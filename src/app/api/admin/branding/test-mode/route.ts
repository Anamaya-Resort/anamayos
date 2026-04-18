import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * POST /api/admin/branding/test-mode
 * Enter or exit test mode for the current admin.
 * Body: { action: 'enter' | 'exit' }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { action } = await request.json() as { action: string };
  const cookieStore = await cookies();
  const supabase = createServiceClient();

  if (action === 'enter') {
    // If no test_branding exists, copy live branding as starting point
    const { data } = await supabase
      .from('org_branding').select('branding, test_branding').eq('org_slug', 'default').single();

    if (!data?.test_branding) {
      await supabase.from('org_branding').upsert(
        { org_slug: 'default', test_branding: data?.branding ?? {} },
        { onConflict: 'org_slug' },
      );
    }

    cookieStore.set('ao_test_branding', '1', {
      path: '/',
      httpOnly: false, // client needs to read this
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return Response.json({ ok: true, isTestMode: true });
  }

  if (action === 'exit') {
    cookieStore.delete('ao_test_branding');
    return Response.json({ ok: true, isTestMode: false });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
