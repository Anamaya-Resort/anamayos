import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getWorkerStatus } from '@/modules/video/worker-status';
import { publicUrl } from '@/modules/video/media-url';

const PAGE = 60;


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
  proxy_path: string | null;
  proxy_status: string;
  analysis_status: string;
  duplicate_status: string | null;
  aesthetic_score: number | null;
  is_favorite: boolean;
  created_at: string;
};

/** Sort keys the grid offers. Newest is the default. */
const SORTS = ['newest', 'oldest', 'az', 'za', 'favorites'] as const;
type Sort = (typeof SORTS)[number];

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
  const rawSort = sp.get('sort') ?? 'newest';
  const sort: Sort = (SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as Sort)
    : 'newest';

  const supabase = createServiceClient();

  // Pipeline rollup — drives the status strip, so "why is this image
  // still a grey box?" is answerable without opening the Scan Theater.
  const countFor = (col: 'proxy_status' | 'analysis_status', value?: string) => {
    let c = supabase
      .from('video_assets')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_deleted_on_drive', false);
    if (value) c = c.eq(col, value);
    return c;
  };
  const [allC, proxiedC, taggedC, proxyErrC, analysisErrC, worker] =
    await Promise.all([
      countFor('proxy_status'),
      countFor('proxy_status', 'done'),
      countFor('analysis_status', 'done'),
      countFor('proxy_status', 'error'),
      countFor('analysis_status', 'error'),
      getWorkerStatus(),
    ]);
  const status = {
    total: allC.count ?? 0,
    proxied: proxiedC.count ?? 0,
    tagged: taggedC.count ?? 0,
    failed: (proxyErrC.count ?? 0) + (analysisErrC.count ?? 0),
  };

  let query = supabase
    .from('video_assets')
    .select(
      'id, file_name, drive_path, mime_type, size_bytes, duration_ms, width, height, thumb_path, proxy_path, proxy_status, analysis_status, duplicate_status, aesthetic_score, is_favorite, created_at',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false);

  if (filter === 'duplicates') query = query.not('duplicate_status', 'is', null);
  if (filter === 'recent') {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    query = query.gte('created_at', since);
  }
  if (filter === 'tagged') query = query.eq('analysis_status', 'done');
  if (filter === 'processing') {
    query = query.or('proxy_status.neq.done,analysis_status.neq.done');
  }
  if (filter === 'failed') {
    query = query.or('proxy_status.eq.error,analysis_status.eq.error');
  }



  // A search is matched, ordered and paged entirely in the database.
  // The old version ran a tag lookup then pasted up to 500 uuids into
  // id.in.(...) - roughly 18KB of query string, which a broad word
  // like "drone" blew past, so the request failed and the search
  // silently returned nothing. It also never looked at drive_path, so
  // a photo filed under /Drone/ was unfindable unless the model
  // happened to mention a drone.
  if (q) {
    const { data: hits, error: searchErr } = await supabase.rpc('search_assets_page', {
      p_org_id: orgId,
      p_q: q,
      p_sort: sort,
      p_limit: PAGE,
      p_offset: offset,
    });
    if (searchErr) {
      return NextResponse.json({ error: searchErr.message }, { status: 500 });
    }
    const page = (hits ?? []) as { asset_id: string; total_count: number }[];
    if (page.length === 0) {
      return NextResponse.json({
        total: 0, offset, pageSize: PAGE, status, worker, assets: [],
      });
    }
    const ids = page.map((r) => r.asset_id);
    const { data: rowsData } = await supabase
      .from('video_assets')
      .select(
        'id, file_name, drive_path, mime_type, size_bytes, duration_ms, width, height, thumb_path, proxy_path, proxy_status, analysis_status, duplicate_status, aesthetic_score, is_favorite, created_at',
      )
      .in('id', ids);

    // .in() gives no order, so restore the one the search decided.
    const byId = new Map(((rowsData ?? []) as Row[]).map((r) => [r.id, r]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((r): r is Row => !!r);

    return NextResponse.json({
      total: Number(page[0].total_count),
      offset,
      pageSize: PAGE,
      status,
      worker,
      assets: ordered.map((r) => ({
        ...r,
        thumb_url: publicUrl(r.thumb_path),
        proxy_url: publicUrl(r.proxy_path),
      })),
    });
  }

  // Favourites is a filter as well as an order, so it narrows here.
  if (sort === 'favorites') query = query.eq('is_favorite', true);

  const ordered =
    sort === 'oldest'
      ? query.order('created_at', { ascending: true })
      : sort === 'az'
        ? query.order('file_name', { ascending: true })
        : sort === 'za'
          ? query.order('file_name', { ascending: false })
          : sort === 'favorites'
            ? query.order('favorited_at', { ascending: false, nullsFirst: false })
            : query.order('created_at', { ascending: false });

  const { data, count } = await ordered.range(offset, offset + PAGE - 1);

  const rows = (data ?? []) as Row[];

  return NextResponse.json({
    total: count ?? 0,
    offset,
    pageSize: PAGE,
    status,
    worker,
    assets: rows.map((r) => ({
      ...r,
      thumb_url: publicUrl(r.thumb_path),
      proxy_url: publicUrl(r.proxy_path),
    })),
  });
}
