import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveOrgId } from '@/lib/get-active-org';
import { canManageVisuals } from '@/modules/video/auth';
import { createServiceClient } from '@/lib/supabase/server';

const SIGNED_TTL = 60 * 60;

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

  const [{ data: counts }, { data: arche }] = await Promise.all([
    supabase
      .from('video_assets')
      .select('analysis_status')
      .eq('org_id', orgId)
      .eq('is_deleted_on_drive', false),
    supabase
      .from('ai_customer_archetypes')
      .select('id, name')
      .eq('org_id', orgId),
  ]);

  const progress = { done: 0, analyzing: 0, pending: 0, error: 0, total: 0 };
  for (const r of (counts ?? []) as { analysis_status: string }[]) {
    progress.total++;
    if (r.analysis_status in progress) {
      (progress as Record<string, number>)[r.analysis_status]++;
    }
  }
  const archName = new Map(
    ((arche ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]),
  );

  const { data: rows } = await supabase
    .from('video_assets')
    .select(
      'id, file_name, mime_type, proxy_path, thumb_path, color_temp, aesthetic_score, detections, archetype_fit',
    )
    .eq('org_id', orgId)
    .eq('analysis_status', 'done')
    .not('proxy_path', 'is', null)
    .order('id', { ascending: false })
    .limit(40);

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
      supabase
        .from('video_asset_tags')
        .select('asset_id, category, tag')
        .in('asset_id', assetIds)
        .eq('source', 'ai'),
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
