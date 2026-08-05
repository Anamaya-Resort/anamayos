import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getWorkerStatus } from '@/modules/video/worker-status';

const PAGE = 60;
const SIGNED_TTL = 60 * 60; // 1h
/** Cap on ids folded in from a tag/summary match, to bound the URL. */
const MATCH_CAP = 500;

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
  analysis_status: string;
  duplicate_status: string | null;
  aesthetic_score: number | null;
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
      'id, file_name, drive_path, mime_type, size_bytes, duration_ms, width, height, thumb_path, proxy_status, analysis_status, duplicate_status, aesthetic_score, created_at',
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

  if (q) {
    // Search the AI's work too, not just filenames. A library full of
    // DSC_0142.jpg is unsearchable by name; being able to find
    // "sunset yoga" later is the entire point of having tagged it.
    const like = `%${q}%`;
    const [{ data: tagHits }, { data: descHits }] = await Promise.all([
      supabase
        .from('video_asset_tags')
        .select('asset_id')
        .ilike('tag', like)
        .limit(MATCH_CAP),
      supabase
        .from('video_asset_descriptions')
        .select('asset_id')
        .ilike('summary', like)
        .limit(MATCH_CAP),
    ]);
    const ids = Array.from(
      new Set([
        ...((tagHits ?? []) as { asset_id: string }[]).map((r) => r.asset_id),
        ...((descHits ?? []) as { asset_id: string }[]).map((r) => r.asset_id),
      ]),
    ).slice(0, MATCH_CAP);

    query = ids.length
      ? query.or(`file_name.ilike.${like},id.in.(${ids.join(',')})`)
      : query.ilike('file_name', like);
  }

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
    status,
    worker,
    assets: rows.map((r) => ({
      ...r,
      thumb_url: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null,
    })),
  });
}
