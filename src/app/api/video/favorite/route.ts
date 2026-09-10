import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canUseVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';

const schema = z
  .object({ id: z.string().uuid(), favorite: z.boolean() })
  .strict();

/**
 * Mark or unmark a favourite. Org-wide rather than per-user: the
 * collection is a shared working set, so "the good ones" is a team
 * judgement anybody with visuals access can revise.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canUseVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('video_assets')
    .update({
      is_favorite: parsed.data.favorite,
      // Cleared on unfavourite so a re-favourite sorts as new, which
      // is what "newest favourites first" should mean.
      favorited_at: parsed.data.favorite ? new Date().toISOString() : null,
      favorited_by: parsed.data.favorite ? (session.personId ?? null) : null,
    })
    .eq('id', parsed.data.id)
    .eq('org_id', orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, favorite: parsed.data.favorite });
}
