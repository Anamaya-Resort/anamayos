/**
 * Read-side queries for the inventoried assets.
 * The browsable library + thumbnails are served by
 * /api/video/library; this module holds the server-side rollups
 * the page needs (per-source counts).
 */
import { createServiceClient } from '@/lib/supabase/server';

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
