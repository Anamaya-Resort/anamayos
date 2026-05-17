import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';

const PAGE = 60;
const SIGNED_TTL = 60 * 60; // 1h

type Row = {
  id: string;
  file_name: string;
  drive_path: string | null;
  mime_type: string;
  size_bytes: number | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  thumb_path: string | null;
  proxy_status: string;
  duplicate_status: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  const filter = sp.get('filter') ?? 'all';
  const q = (sp.get('q') ?? '').trim();
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0);

  const supabase = createServiceClient();
  let query = supabase
    .from('video_assets')
    .select(
      'id, file_name, drive_path, mime_type, size_bytes, duration_ms, width, height, thumb_path, proxy_status, duplicate_status, created_at',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false);

  if (filter === 'duplicates') query = query.not('duplicate_status', 'is', null);
  if (filter === 'recent') {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    query = query.gte('created_at', since);
  }
  if (q) query = query.ilike('file_name', `%${q}%`);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE - 1);

  const rows = (data ?? []) as Row[];

  // Batch-sign thumbnails (private bucket).
  const paths = rows.map((r) => r.thumb_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from('video-proxies')
      .createSignedUrls(paths, SIGNED_TTL);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  return NextResponse.json({
    total: count ?? 0,
    offset,
    pageSize: PAGE,
    assets: rows.map((r) => ({
      ...r,
      thumb_url: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null,
    })),
  });
}
