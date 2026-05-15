/**
 * Read-side queries for the inventoried assets.
 * Slice 1 only needs counts + a small recent preview; the full
 * virtualized library grid lands in Slice 2.
 */
import { createServiceClient } from '@/lib/supabase/server';

export type AssetPreview = {
  id: string;
  file_name: string;
  drive_path: string | null;
  mime_type: string;
  size_bytes: number | null;
  duration_ms: number | null;
  created_at: string;
};

export async function countAssets(orgId: string): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('video_assets')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false);
  return count ?? 0;
}

export async function countAssetsBySource(
  orgId: string,
): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('video_assets')
    .select('source_id')
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false)
    .limit(100000);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { source_id: string }[]) {
    counts[row.source_id] = (counts[row.source_id] ?? 0) + 1;
  }
  return counts;
}

export async function recentAssets(
  orgId: string,
  limit = 24,
): Promise<AssetPreview[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('video_assets')
    .select('id, file_name, drive_path, mime_type, size_bytes, duration_ms, created_at')
    .eq('org_id', orgId)
    .eq('is_deleted_on_drive', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AssetPreview[];
}
