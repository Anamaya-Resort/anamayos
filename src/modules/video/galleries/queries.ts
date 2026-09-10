/**
 * Galleries: named, ordered sets of library images.
 *
 * An image belongs to the library; a gallery only references it. So
 * adding to a gallery never moves or copies anything, and removing
 * from a gallery never touches the image.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { publicUrl } from '@/modules/video/media-url';

export type GallerySummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_published: boolean;
  item_count: number;
  updated_at: string;
  /** Up to four thumbnails, for the row preview. */
  previews: string[];
};

export async function listGalleries(orgId: string): Promise<GallerySummary[]> {
  const supabase = createServiceClient();
  const { data: galleries } = await supabase
    .from('video_galleries')
    .select('id, code, name, description, is_published, updated_at')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  const rows = (galleries ?? []) as Omit<GallerySummary, 'item_count' | 'previews'>[];
  if (rows.length === 0) return [];

  // Membership for every gallery in one pass, then counted in memory:
  // a per-gallery count query would be one round trip each.
  const { data: items } = await supabase
    .from('video_gallery_items')
    .select('gallery_id, asset_id, sort_order')
    .in('gallery_id', rows.map((g) => g.id))
    .order('sort_order', { ascending: true });

  const byGallery = new Map<string, string[]>();
  for (const it of (items ?? []) as { gallery_id: string; asset_id: string }[]) {
    const list = byGallery.get(it.gallery_id) ?? [];
    list.push(it.asset_id);
    byGallery.set(it.gallery_id, list);
  }

  const previewIds = [...byGallery.values()].flatMap((ids) => ids.slice(0, 4));
  const thumbByAsset = new Map<string, string>();
  if (previewIds.length > 0) {
    const { data: assets } = await supabase
      .from('video_assets')
      .select('id, thumb_path')
      .in('id', [...new Set(previewIds)]);
    for (const a of (assets ?? []) as { id: string; thumb_path: string | null }[]) {
      const u = publicUrl(a.thumb_path);
      if (u) thumbByAsset.set(a.id, u);
    }
  }

  return rows.map((g) => {
    const ids = byGallery.get(g.id) ?? [];
    return {
      ...g,
      item_count: ids.length,
      previews: ids
        .slice(0, 4)
        .map((id) => thumbByAsset.get(id))
        .filter((u): u is string => !!u),
    };
  });
}

export async function createGallery(opts: {
  orgId: string;
  name: string;
  createdBy: string | null;
  assetIds?: string[];
}): Promise<{ id: string; code: string }> {
  const supabase = createServiceClient();
  const { data: codeRow, error: codeErr } = await supabase.rpc('next_gallery_code', {
    p_org_id: opts.orgId,
  });
  if (codeErr) throw new Error(`could not allocate a code: ${codeErr.message}`);
  const code = codeRow as unknown as string;

  const { data, error } = await supabase
    .from('video_galleries')
    .insert({
      org_id: opts.orgId,
      code,
      name: opts.name,
      created_by: opts.createdBy,
    })
    .select('id, code')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'create failed');

  if (opts.assetIds?.length) {
    await addToGallery({
      orgId: opts.orgId,
      galleryId: data.id,
      assetIds: opts.assetIds,
      addedBy: opts.createdBy,
    });
  }
  return { id: data.id, code: data.code };
}

/** Appends, skipping anything already there. Returns how many were new. */
export async function addToGallery(opts: {
  orgId: string;
  galleryId: string;
  assetIds: string[];
  addedBy: string | null;
}): Promise<{ added: number; alreadyThere: number }> {
  const supabase = createServiceClient();

  const { data: gallery } = await supabase
    .from('video_galleries')
    .select('id')
    .eq('id', opts.galleryId)
    .eq('org_id', opts.orgId)
    .maybeSingle();
  if (!gallery) throw new Error('gallery not found');

  // Only images this org actually owns.
  const { data: owned } = await supabase
    .from('video_assets')
    .select('id')
    .eq('org_id', opts.orgId)
    .in('id', opts.assetIds);
  const validIds = ((owned ?? []) as { id: string }[]).map((r) => r.id);
  if (validIds.length === 0) return { added: 0, alreadyThere: 0 };

  const { data: existing } = await supabase
    .from('video_gallery_items')
    .select('asset_id, sort_order')
    .eq('gallery_id', opts.galleryId);
  const have = new Set(
    ((existing ?? []) as { asset_id: string }[]).map((r) => r.asset_id),
  );
  const maxOrder = ((existing ?? []) as { sort_order: number }[]).reduce(
    (m, r) => Math.max(m, r.sort_order ?? 0),
    0,
  );

  const fresh = validIds.filter((id) => !have.has(id));
  if (fresh.length > 0) {
    const { error } = await supabase.from('video_gallery_items').insert(
      fresh.map((asset_id, i) => ({
        gallery_id: opts.galleryId,
        asset_id,
        sort_order: maxOrder + 1 + i,
        added_by: opts.addedBy,
      })),
    );
    if (error) throw new Error(error.message);
    await supabase
      .from('video_galleries')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', opts.galleryId);
  }

  return { added: fresh.length, alreadyThere: validIds.length - fresh.length };
}
