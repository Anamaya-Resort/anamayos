/**
 * Archiving: how an image leaves the collection.
 *
 * Not a delete. A row can be referenced by a published gallery, and
 * the website reads those live, so removing it outright would blank a
 * live page with no warning and nothing to restore from. Archived
 * images drop out of the grid, out of search and out of the counts,
 * and can be brought back.
 *
 * Emptying the archive for good is deliberately separate: it also
 * removes the stored thumbnail and preview, which is the only copy
 * this system holds - the full-size original lives in Drive or
 * Dropbox, not here.
 */
import { createServiceClient } from '@/lib/supabase/server';

export async function archiveAssets(opts: {
  orgId: string;
  assetIds: string[];
  by: string | null;
}): Promise<{ archived: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('video_assets')
    .update({ archived_at: new Date().toISOString(), archived_by: opts.by })
    .eq('org_id', opts.orgId)
    .in('id', opts.assetIds)
    .is('archived_at', null)
    .select('id');
  if (error) throw new Error(`archive failed: ${error.message}`);
  return { archived: (data ?? []).length };
}

export async function restoreAssets(opts: {
  orgId: string;
  assetIds: string[];
}): Promise<{ restored: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('video_assets')
    .update({ archived_at: null, archived_by: null })
    .eq('org_id', opts.orgId)
    .in('id', opts.assetIds)
    .not('archived_at', 'is', null)
    .select('id');
  if (error) throw new Error(`restore failed: ${error.message}`);
  return { restored: (data ?? []).length };
}

/**
 * Remove archived images permanently, stored files and all.
 *
 * Only ever touches rows already archived, so a mis-click in the grid
 * cannot reach this. Storage first: if the row went first, the files
 * would be orphaned with nothing left pointing at them.
 */
export async function purgeArchived(opts: {
  orgId: string;
  assetIds: string[];
}): Promise<{ purged: number; filesRemoved: number }> {
  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from('video_assets')
    .select('id, thumb_path, proxy_path, original_path')
    .eq('org_id', opts.orgId)
    .in('id', opts.assetIds)
    .not('archived_at', 'is', null);

  const list = (rows ?? []) as {
    id: string;
    thumb_path: string | null;
    proxy_path: string | null;
    original_path: string | null;
  }[];
  if (list.length === 0) return { purged: 0, filesRemoved: 0 };

  const paths = list
    .flatMap((r) => [r.thumb_path, r.proxy_path, r.original_path])
    .filter((p): p is string => !!p);

  let filesRemoved = 0;
  if (paths.length > 0) {
    const { data: removed } = await supabase.storage
      .from('video-proxies')
      .remove(paths);
    filesRemoved = (removed ?? []).length;
  }

  const { data: gone, error } = await supabase
    .from('video_assets')
    .delete()
    .eq('org_id', opts.orgId)
    .in('id', list.map((r) => r.id))
    .select('id');
  if (error) throw new Error(`purge failed: ${error.message}`);
  return { purged: (gone ?? []).length, filesRemoved };
}

export type TagFacet = { category: string; tag: string; n: number };

/**
 * The tag vocabulary, with a count per tag.
 *
 * There are 1,445 distinct tags and no way to see any of them: the
 * only way into the collection was guessing words into the search
 * box. Grouped by the category the model assigned (subject, mood,
 * activity, people, marketing_use), which is what makes it browsable
 * rather than a wall of words.
 */
export async function tagFacets(opts: {
  orgId: string;
  category?: string | null;
  q?: string | null;
  limit?: number;
}): Promise<TagFacet[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('gallery_tag_facets', {
    p_org_id: opts.orgId,
    p_category: opts.category ?? null,
    p_q: opts.q ?? null,
    p_limit: opts.limit ?? 400,
  });
  if (error) throw new Error(`tag facets failed: ${error.message}`);
  return ((data ?? []) as { category: string; tag: string; n: number }[]).map((r) => ({
    category: r.category,
    tag: r.tag,
    n: Number(r.n),
  }));
}
