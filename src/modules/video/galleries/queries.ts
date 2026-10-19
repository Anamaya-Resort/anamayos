/**
 * Galleries: named, ordered sets of library images.
 *
 * An image belongs to the library; a gallery only references it. So
 * adding to a gallery never moves or copies anything, and removing
 * from a gallery never touches the image.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { publicUrl } from '@/modules/video/media-url';

/** Enough for the filmstrip to render, size, open and enlarge an image. */
export type GalleryItem = {
  id: string;
  file_name: string;
  thumb_url: string | null;
  proxy_url: string | null;
  width: number | null;
  height: number | null;
  mime_type: string;
  aesthetic_score: number | null;
  analysis_status: string;
  drive_path: string | null;
};

export type GallerySummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_published: boolean;
  item_count: number;
  updated_at: string;
  items: GalleryItem[];
};

/**
 * Cap per gallery. The strip scrolls, but shipping every image of a
 * thousand-image gallery to render a row nobody will scroll to the end
 * of is not worth the payload.
 */
const STRIP_CAP = 80;

export async function listGalleries(orgId: string): Promise<GallerySummary[]> {
  const supabase = createServiceClient();
  const { data: galleries } = await supabase
    .from('video_galleries')
    .select('id, code, name, description, is_published, updated_at')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  const rows = (galleries ?? []) as Omit<GallerySummary, 'item_count' | 'previews'>[];
  if (rows.length === 0) return [];

  // Membership for every gallery in one pass, then grouped in memory:
  // a per-gallery query would be one round trip each.
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

  const wanted = [...byGallery.values()].flatMap((ids) => ids.slice(0, STRIP_CAP));
  const assetById = new Map<string, GalleryItem>();
  if (wanted.length > 0) {
    const { data: assets } = await supabase
      .from('video_assets')
      .select(
        'id, file_name, thumb_path, proxy_path, width, height, mime_type, aesthetic_score, analysis_status, drive_path',
      )
      .in('id', [...new Set(wanted)]);
    type Row = {
      id: string;
      file_name: string;
      thumb_path: string | null;
      proxy_path: string | null;
      width: number | null;
      height: number | null;
      mime_type: string;
      aesthetic_score: number | null;
      analysis_status: string;
      drive_path: string | null;
    };
    for (const a of (assets ?? []) as Row[]) {
      assetById.set(a.id, {
        id: a.id,
        file_name: a.file_name,
        thumb_url: publicUrl(a.thumb_path),
        proxy_url: publicUrl(a.proxy_path),
        width: a.width,
        height: a.height,
        mime_type: a.mime_type,
        aesthetic_score: a.aesthetic_score,
        analysis_status: a.analysis_status,
        drive_path: a.drive_path,
      });
    }
  }

  return rows.map((g) => {
    const ids = byGallery.get(g.id) ?? [];
    return {
      ...g,
      item_count: ids.length,
      // Gallery order, not the order the asset query happened to return.
      items: ids
        .slice(0, STRIP_CAP)
        .map((id) => assetById.get(id))
        .filter((a): a is GalleryItem => !!a),
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

/**
 * Remove images from a gallery. The images themselves are untouched -
 * a gallery references the library, it does not own it.
 */
export async function removeFromGallery(opts: {
  orgId: string;
  galleryId: string;
  assetIds: string[];
}): Promise<{ removed: number }> {
  const supabase = createServiceClient();

  const { data: gallery } = await supabase
    .from('video_galleries')
    .select('id')
    .eq('id', opts.galleryId)
    .eq('org_id', opts.orgId)
    .maybeSingle();
  if (!gallery) throw new Error('gallery not found');

  const { data, error } = await supabase
    .from('video_gallery_items')
    .delete()
    .eq('gallery_id', opts.galleryId)
    .in('asset_id', opts.assetIds)
    .select('asset_id');
  if (error) throw new Error(error.message);

  await supabase
    .from('video_galleries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', opts.galleryId);

  return { removed: (data ?? []).length };
}

/**
 * Publish or unpublish a gallery.
 *
 * The only switch that decides whether the public site can see a
 * gallery at all: RLS lets the anon key read published galleries, the
 * images in them, and nothing else. So this is also the control that
 * decides which library photographs are readable from outside - an
 * unpublished gallery is invisible even to somebody holding its code.
 */
export async function setGalleryPublished(opts: {
  orgId: string;
  galleryId: string;
  isPublished: boolean;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('video_galleries')
    .update({ is_published: opts.isPublished, updated_at: new Date().toISOString() })
    .eq('id', opts.galleryId)
    .eq('org_id', opts.orgId);
  if (error) throw new Error(`publish failed: ${error.message}`);
}


/**
 * Rename a gallery, or change its description or cover.
 *
 * The code is deliberately not editable: it is what every page and
 * template in the website points at, so letting it change here would
 * silently blank whatever already used the old one.
 */
export async function updateGallery(opts: {
  orgId: string;
  galleryId: string;
  name?: string;
  description?: string | null;
  coverAssetId?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (opts.name !== undefined) patch.name = opts.name;
  if (opts.description !== undefined) patch.description = opts.description;
  if (opts.coverAssetId !== undefined) patch.cover_asset_id = opts.coverAssetId;

  const { error } = await supabase
    .from('video_galleries')
    .update(patch)
    .eq('id', opts.galleryId)
    .eq('org_id', opts.orgId);
  if (error) throw new Error(`update gallery failed: ${error.message}`);
}

/**
 * Put a gallery's images in a given order.
 *
 * The order is the gallery's whole point once it reaches a page, and
 * until now it could not be changed at all - sort_order was written
 * on insert and never touched again.
 *
 * Applied in one statement by reorder_gallery(), so an interrupted
 * reorder cannot leave two images claiming the same position.
 */
export async function reorderGallery(opts: {
  orgId: string;
  galleryId: string;
  assetIds: string[];
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('reorder_gallery', {
    p_org_id: opts.orgId,
    p_gallery_id: opts.galleryId,
    p_asset_ids: opts.assetIds,
  });
  if (error) throw new Error(`reorder failed: ${error.message}`);
}

/** Caption one image as it appears in one gallery. */
export async function setGalleryItemCaption(opts: {
  orgId: string;
  galleryId: string;
  assetId: string;
  caption: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  // The caption belongs to the membership, not the image: the same
  // photograph can carry a different line in two galleries. So the
  // org is checked through the gallery rather than on the item.
  const { data: g } = await supabase
    .from('video_galleries')
    .select('id')
    .eq('id', opts.galleryId)
    .eq('org_id', opts.orgId)
    .maybeSingle();
  if (!g) throw new Error('gallery not found');

  const { error } = await supabase
    .from('video_gallery_items')
    .update({ caption: opts.caption })
    .eq('gallery_id', opts.galleryId)
    .eq('asset_id', opts.assetId);
  if (error) throw new Error(`caption failed: ${error.message}`);
}

/**
 * Delete a gallery.
 *
 * Membership rows go with it (ON DELETE CASCADE); the photographs do
 * not, because a gallery only ever referenced them.
 *
 * The code is never reissued, so a page still pointing at a deleted
 * gallery resolves to nothing rather than to somebody else's photos.
 */
export async function deleteGallery(opts: {
  orgId: string;
  galleryId: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('video_galleries')
    .delete()
    .eq('id', opts.galleryId)
    .eq('org_id', opts.orgId);
  if (error) throw new Error(`delete gallery failed: ${error.message}`);
}
