/**
 * Slice 4 — Staff Review + Privacy.
 *
 * The flip-through review queue, inbox counts, and the write path
 * for a human decision. video_asset_reviews is the append-only
 * audit trail; video_asset_permissions holds the one current
 * permission row; video_assets.review_status / use_permission are
 * the denormalized mirrors the inboxes filter on (migration 00046).
 * Every write keeps all three consistent in one request.
 */
import { createServiceClient } from '@/lib/supabase/server';
import type { ReviewInput } from '@/modules/video/schemas';
import { loadSegments, type ReviewSegment } from './segments';

const PAGE = 24;
const SIGNED_TTL = 60 * 60; // 1h

export type ReviewFilter =
  | 'needs_review'
  | 'needs_consent'
  | 'approved'
  | 'rejected'
  | 'all';

export type Detection = {
  label: string;
  kind: 'face' | 'object';
  role: 'primary' | 'secondary' | 'none';
  bbox: [number, number, number, number];
  confidence?: number;
};

export type ReviewItem = {
  id: string;
  file_name: string;
  kind: 'image' | 'video';
  image_url: string | null;
  width: number | null;
  height: number | null;
  color_temp: string | null;
  aesthetic_score: number | null;
  detections: Detection[];
  has_faces: boolean;
  review_status: string;
  use_permission: string;
  has_recognizable_faces: boolean | null;
  has_minor_faces: boolean | null;
  is_staff_only: boolean | null;
  notes: string;
  tags: { tag: string; source: string }[];
  summary: string;
  top_archetype: { name: string; score: number } | null;
  segments: ReviewSegment[];
};

export type ReviewCounts = {
  needs_review: number;
  needs_consent: number;
  approved: number;
  rejected: number;
};

function baseSelect(supabase: ReturnType<typeof createServiceClient>, orgId: string) {
  return supabase
    .from('video_assets')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false)
    .eq('analysis_status', 'done');
}

export async function reviewCounts(orgId: string): Promise<ReviewCounts> {
  const supabase = createServiceClient();
  const [nr, nc, ap, rj] = await Promise.all([
    baseSelect(supabase, orgId).eq('review_status', 'pending'),
    baseSelect(supabase, orgId).eq('use_permission', 'unknown'),
    baseSelect(supabase, orgId).eq('review_status', 'approved'),
    baseSelect(supabase, orgId).eq('review_status', 'rejected'),
  ]);
  return {
    needs_review: nr.count ?? 0,
    needs_consent: nc.count ?? 0,
    approved: ap.count ?? 0,
    rejected: rj.count ?? 0,
  };
}

export async function getReviewQueue(
  orgId: string,
  filter: ReviewFilter,
  offset: number,
): Promise<{ total: number; offset: number; pageSize: number; items: ReviewItem[] }> {
  const supabase = createServiceClient();

  let query = supabase
    .from('video_assets')
    .select(
      'id, file_name, mime_type, proxy_path, thumb_path, width, height, color_temp, aesthetic_score, detections, archetype_fit, review_status, use_permission',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false)
    .eq('analysis_status', 'done')
    .not('proxy_path', 'is', null);

  if (filter === 'needs_review') query = query.eq('review_status', 'pending');
  else if (filter === 'needs_consent') query = query.eq('use_permission', 'unknown');
  else if (filter === 'approved') query = query.eq('review_status', 'approved');
  else if (filter === 'rejected') query = query.eq('review_status', 'rejected');

  const { data, count } = await query
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE - 1);

  type Row = {
    id: string;
    file_name: string;
    mime_type: string;
    proxy_path: string;
    thumb_path: string | null;
    width: number | null;
    height: number | null;
    color_temp: string | null;
    aesthetic_score: number | null;
    detections: Detection[] | null;
    archetype_fit: { archetype_id: string; score: number }[] | null;
    review_status: string;
    use_permission: string;
  };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return { total: count ?? 0, offset, pageSize: PAGE, items: [] };
  }

  const ids = rows.map((r) => r.id);
  const videoIds = rows
    .filter((r) => r.mime_type.startsWith('video/'))
    .map((r) => r.id);
  const paths = [
    ...rows.map((r) => r.proxy_path),
    ...rows.map((r) => r.thumb_path).filter((p): p is string => !!p),
  ];

  const [{ data: urls }, { data: tags }, { data: descs }, { data: perms }, { data: arche }] =
    await Promise.all([
      supabase.storage.from('video-proxies').createSignedUrls(paths, SIGNED_TTL),
      supabase
        .from('video_asset_tags')
        .select('asset_id, tag, source')
        .in('asset_id', ids),
      supabase
        .from('video_asset_descriptions')
        .select('asset_id, summary')
        .in('asset_id', ids),
      supabase
        .from('video_asset_permissions')
        .select(
          'asset_id, has_recognizable_faces, has_minor_faces, is_staff_only, permission_notes',
        )
        .in('asset_id', ids),
      supabase.from('ai_customer_archetypes').select('id, name').eq('org_id', orgId),
    ]);

  const signed = new Map<string, string>();
  for (const u of urls ?? []) {
    if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const tagsByAsset = new Map<string, { tag: string; source: string }[]>();
  for (const t of (tags ?? []) as { asset_id: string; tag: string; source: string }[]) {
    if (!tagsByAsset.has(t.asset_id)) tagsByAsset.set(t.asset_id, []);
    tagsByAsset.get(t.asset_id)!.push({ tag: t.tag, source: t.source });
  }
  const descByAsset = new Map<string, string>();
  for (const d of (descs ?? []) as { asset_id: string; summary: string }[]) {
    descByAsset.set(d.asset_id, d.summary);
  }
  type PermRow = {
    asset_id: string;
    has_recognizable_faces: boolean | null;
    has_minor_faces: boolean | null;
    is_staff_only: boolean | null;
    permission_notes: string | null;
  };
  const permByAsset = new Map<string, PermRow>();
  for (const p of (perms ?? []) as PermRow[]) permByAsset.set(p.asset_id, p);
  const archName = new Map(
    ((arche ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]),
  );
  const segByAsset = await loadSegments(videoIds);

  const items: ReviewItem[] = rows.map((r) => {
    const isVideo = r.mime_type.startsWith('video/');
    const segs = segByAsset.get(r.id) ?? [];
    // Hero frame for a video = its best-scoring segment (it carries
    // detections + a real still); fall back to the poster.
    const hero = segs.length
      ? [...segs].sort(
          (a, b) => (b.aesthetic_score ?? 0) - (a.aesthetic_score ?? 0),
        )[0]
      : null;
    const dets = isVideo ? hero?.detections ?? [] : r.detections ?? [];
    const imageUrl = isVideo
      ? hero?.frame_url ??
        (r.thumb_path ? signed.get(r.thumb_path) ?? null : null)
      : signed.get(r.proxy_path) ?? null;
    const perm = permByAsset.get(r.id);
    const fit = (r.archetype_fit ?? [])
      .map((f) => ({ name: archName.get(f.archetype_id) ?? '', score: f.score }))
      .filter((f) => f.name)
      .sort((a, b) => b.score - a.score);
    return {
      id: r.id,
      file_name: r.file_name,
      kind: isVideo ? 'video' : 'image',
      image_url: imageUrl,
      width: r.width,
      height: r.height,
      color_temp: r.color_temp,
      aesthetic_score: r.aesthetic_score,
      detections: dets,
      has_faces: dets.some((d) => d.kind === 'face'),
      review_status: r.review_status,
      use_permission: r.use_permission,
      has_recognizable_faces: perm?.has_recognizable_faces ?? null,
      has_minor_faces: perm?.has_minor_faces ?? null,
      is_staff_only: perm?.is_staff_only ?? null,
      notes: perm?.permission_notes ?? '',
      tags: tagsByAsset.get(r.id) ?? [],
      summary: descByAsset.get(r.id) ?? '',
      top_archetype: fit[0] ?? null,
      segments: segs,
    };
  });

  return { total: count ?? 0, offset, pageSize: PAGE, items };
}

/** Persist one reviewer decision; keeps audit + permission + mirrors in sync. */
export async function saveReview(
  orgId: string,
  assetId: string,
  reviewerId: string,
  input: ReviewInput,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: owned } = await supabase
    .from('video_assets')
    .select('id')
    .eq('id', assetId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!owned) throw new Error('not_found');

  const tags = Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean)));
  const notes = input.notes?.trim() || null;

  await supabase.from('video_asset_reviews').insert({
    asset_id: assetId,
    reviewer_id: reviewerId,
    approval_status: input.approval_status,
    corrected_tags: tags,
    staff_notes: notes,
  });

  await supabase.from('video_asset_permissions').upsert(
    {
      asset_id: assetId,
      use_permission: input.use_permission,
      has_recognizable_faces: input.has_recognizable_faces ?? null,
      has_minor_faces: input.has_minor_faces ?? null,
      is_staff_only: input.is_staff_only ?? null,
      permission_notes: notes,
      set_by: reviewerId,
      set_at: new Date().toISOString(),
    },
    { onConflict: 'asset_id' },
  );

  await supabase
    .from('video_assets')
    .update({
      review_status: input.approval_status,
      use_permission: input.use_permission,
    })
    .eq('id', assetId)
    .eq('org_id', orgId);

  // Human tag set replaces prior human tags; AI rows stay as provenance.
  await supabase
    .from('video_asset_tags')
    .delete()
    .eq('asset_id', assetId)
    .eq('source', 'human');
  if (tags.length > 0) {
    await supabase.from('video_asset_tags').insert(
      tags.map((tag) => ({ asset_id: assetId, tag, source: 'human', category: null })),
    );
  }
}

/** Coarse decision applied to an explicit, org-scoped set of assets. */
export async function bulkApply(
  orgId: string,
  assetIds: string[],
  reviewerId: string,
  decision: { approval_status?: 'approved' | 'rejected' | 'pending'; use_permission?: string },
): Promise<{ applied: number }> {
  const supabase = createServiceClient();

  const { data: owned } = await supabase
    .from('video_assets')
    .select('id')
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false)
    .in('id', assetIds);
  const ids = ((owned ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return { applied: 0 };

  if (decision.use_permission) {
    await supabase.from('video_asset_permissions').upsert(
      ids.map((asset_id) => ({
        asset_id,
        use_permission: decision.use_permission,
        set_by: reviewerId,
        set_at: new Date().toISOString(),
      })),
      { onConflict: 'asset_id' },
    );
    await supabase
      .from('video_assets')
      .update({ use_permission: decision.use_permission })
      .eq('org_id', orgId)
      .in('id', ids);
  }

  if (decision.approval_status) {
    await supabase.from('video_asset_reviews').insert(
      ids.map((asset_id) => ({
        asset_id,
        reviewer_id: reviewerId,
        approval_status: decision.approval_status,
      })),
    );
    await supabase
      .from('video_assets')
      .update({ review_status: decision.approval_status })
      .eq('org_id', orgId)
      .in('id', ids);
  }

  return { applied: ids.length };
}
