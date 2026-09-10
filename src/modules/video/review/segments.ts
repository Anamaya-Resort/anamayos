/**
 * Video segments for review/scan surfaces. A video asset is one
 * file-level row whose tagged, timecoded clips live in
 * video_asset_segments (migration 00047). This batch-loads them
 * with signed frame URLs + each segment's AI tags.
 */
import { createServiceClient } from '@/lib/supabase/server';
import type { Detection } from './queries';
import { publicUrl } from '@/modules/video/media-url';


export type ReviewSegment = {
  idx: number;
  start_ms: number;
  end_ms: number;
  frame_url: string | null;
  aesthetic_score: number | null;
  summary: string;
  detections: Detection[];
  tags: string[];
};

/** assetId → ordered segments, for the given video asset ids. */
export async function loadSegments(
  assetIds: string[],
): Promise<Map<string, ReviewSegment[]>> {
  const out = new Map<string, ReviewSegment[]>();
  if (assetIds.length === 0) return out;

  const supabase = createServiceClient();
  const { data: segs } = await supabase
    .from('video_asset_segments')
    .select(
      'id, asset_id, idx, start_ms, end_ms, frame_path, aesthetic_score, summary, detections',
    )
    .in('asset_id', assetIds)
    .order('idx', { ascending: true });

  type SegRow = {
    id: string;
    asset_id: string;
    idx: number;
    start_ms: number;
    end_ms: number;
    frame_path: string | null;
    aesthetic_score: number | null;
    summary: string | null;
    detections: Detection[] | null;
  };
  const rows = (segs ?? []) as SegRow[];
  if (rows.length === 0) return out;

  const segIds = rows.map((r) => r.id);
  const tagsBySeg = new Map<string, string[]>();
  const { data: tags } = await supabase
    .from('video_asset_tags')
    .select('segment_id, tag')
    .in('segment_id', segIds)
    .eq('source', 'ai');
  for (const t of (tags ?? []) as { segment_id: string; tag: string }[]) {
    if (!tagsBySeg.has(t.segment_id)) tagsBySeg.set(t.segment_id, []);
    tagsBySeg.get(t.segment_id)!.push(t.tag);
  }

  for (const r of rows) {
    if (!out.has(r.asset_id)) out.set(r.asset_id, []);
    out.get(r.asset_id)!.push({
      idx: r.idx,
      start_ms: r.start_ms,
      end_ms: r.end_ms,
      frame_url: publicUrl(r.frame_path),
      aesthetic_score: r.aesthetic_score,
      summary: r.summary ?? '',
      detections: r.detections ?? [],
      tags: tagsBySeg.get(r.id) ?? [],
    });
  }
  return out;
}
