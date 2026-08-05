import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getWorkerStatus } from '@/modules/video/worker-status';

const SIGNED_TTL = 60 * 60;
const FEED_SIZE = 40;

type Detection = {
  label: string;
  kind: 'face' | 'object';
  role: 'primary' | 'secondary' | 'none';
  bbox: [number, number, number, number];
  confidence: number;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canManageVisuals(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const orgId = await getActiveOrgId();
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 400 });

  const supabase = createServiceClient();

  // Counted in the database, not by streaming every row to the app.
  // This endpoint polls every 4 seconds; the old version selected one
  // row per asset each time, so a 20k-image library shipped 20k rows
  // per poll just to produce five integers.
  const countFor = (status?: string) => {
    let q = supabase
      .from('video_assets')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_deleted_on_drive', false);
    if (status) q = q.eq('analysis_status', status);
    return q;
  };

  const [total, done, analyzing, pending, errored, arche, worker] =
    await Promise.all([
      countFor(),
      countFor('done'),
      countFor('analyzing'),
      countFor('pending'),
      countFor('error'),
      supabase.from('ai_customer_archetypes').select('id, name').eq('org_id', orgId),
      getWorkerStatus(),
    ]);

  const progress = {
    total: total.count ?? 0,
    done: done.count ?? 0,
    analyzing: analyzing.count ?? 0,
    pending: pending.count ?? 0,
    error: errored.count ?? 0,
  };
  const archName = new Map(
    ((arche.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]),
  );

  // Newest-analyzed first. This was ordered by `id` — a random uuid —
  // so the theater replayed the same arbitrary 40 assets forever and
  // freshly-tagged media essentially never appeared once the library
  // grew past 40. analyzed_at (migration 00048) is the real axis.
  const { data: rows } = await supabase
    .from('video_assets')
    .select(
      'id, file_name, mime_type, proxy_path, thumb_path, color_temp, aesthetic_score, detections, archetype_fit, analyzed_at',
    )
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false)
    .eq('analysis_status', 'done')
    .not('proxy_path', 'is', null)
    .order('analyzed_at', { ascending: false, nullsFirst: false })
    .limit(FEED_SIZE);

  const list = (rows ?? []) as {
    id: string;
    file_name: string;
    mime_type: string;
    proxy_path: string;
    thumb_path: string | null;
    color_temp: string | null;
    aesthetic_score: number | null;
    detections: Detection[] | null;
    archetype_fit: { archetype_id: string; score: number }[] | null;
    analyzed_at: string | null;
  }[];

  const paths = [
    ...list.map((r) => r.proxy_path),
    ...list.map((r) => r.thumb_path).filter((p): p is string => !!p),
  ];
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from('video-proxies')
      .createSignedUrls(paths, SIGNED_TTL);
    for (const u of urls ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  const assetIds = list.map((r) => r.id);
  const tagsByAsset = new Map<string, { category: string; tag: string }[]>();
  const descByAsset = new Map<string, string>();
  if (assetIds.length > 0) {
    const [{ data: tags }, { data: descs }] = await Promise.all([
      // Whole-asset tags only — a video's per-segment tags belong to
      // its segments, not to the file-level chip row.
      supabase
        .from('video_asset_tags')
        .select('asset_id, category, tag')
        .in('asset_id', assetIds)
        .eq('source', 'ai')
        .is('segment_id', null),
      supabase
        .from('video_asset_descriptions')
        .select('asset_id, summary')
        .in('asset_id', assetIds),
    ]);
    for (const t of (tags ?? []) as { asset_id: string; category: string; tag: string }[]) {
      if (!tagsByAsset.has(t.asset_id)) tagsByAsset.set(t.asset_id, []);
      tagsByAsset.get(t.asset_id)!.push({ category: t.category, tag: t.tag });
    }
    for (const d of (descs ?? []) as { asset_id: string; summary: string }[]) {
      descByAsset.set(d.asset_id, d.summary);
    }
  }

  return NextResponse.json({
    progress,
    worker,
    assets: list.map((r) => {
      const fit = (r.archetype_fit ?? [])
        .map((f) => ({ name: archName.get(f.archetype_id) ?? '', score: f.score }))
        .filter((f) => f.name)
        .sort((a, b) => b.score - a.score);
      const isVideo = r.mime_type.startsWith('video/');
      return {
        id: r.id,
        file_name: r.file_name,
        // Video proxy is an mp4 — show its poster still, not the
        // video, in the <img> theater. Boxes live on segments.
        image_url: isVideo
          ? r.thumb_path
            ? signed.get(r.thumb_path) ?? null
            : null
          : signed.get(r.proxy_path) ?? null,
        color_temp: r.color_temp,
        aesthetic_score: r.aesthetic_score,
        detections: isVideo ? [] : r.detections ?? [],
        tags: tagsByAsset.get(r.id) ?? [],
        summary: descByAsset.get(r.id) ?? '',
        top_archetype: fit[0] ?? null,
      };
    }),
  });
}
