/**
 * Read-side queries for the inventoried assets.
 * The browsable library + thumbnails are served by
 * /api/video/library; this module holds the server-side rollups
 * the page needs (per-source counts).
 */
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Per-source asset counts.
 *
 * Counted in the database, one HEAD request per source. The previous
 * version selected every asset row and tallied them in memory, but
 * PostgREST caps a response at 1000 rows no matter what limit is
 * asked for - so a 6,743 image library was counted from a 1,000 row
 * sample and most folders looked all but empty in the Drive panel.
 */
export async function countAssetsBySource(
  orgId: string,
): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const { data: sources } = await supabase
    .from('video_drive_sources')
    .select('id')
    .eq('org_id', orgId);

  const ids = ((sources ?? []) as { id: string }[]).map((s) => s.id);
  const counts: Record<string, number> = {};
  await Promise.all(
    ids.map(async (id) => {
      const { count } = await supabase
        .from('video_assets')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('source_id', id)
        .eq('is_deleted_on_drive', false);
      counts[id] = count ?? 0;
    }),
  );
  return counts;
}
